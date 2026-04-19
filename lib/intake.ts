import { createAdminClient } from "@/lib/supabase/admin";
import { classifyComplaint } from "@/lib/ai/classifier";
import { sendWhatsApp, Templates } from "@/lib/whatsapp";
import { STATUSES, type Category, type Status } from "@/lib/types";

export type IncomingMessage = {
  phone: string;
  text: string;
  evidenceUrl?: string | null;
  imageDescription?: string;
};

export type IntakeOutcome =
  | { kind: "evidence_required"; replySent: string }
  | {
      kind: "followup";
      replySent: string;
      classification: Awaited<ReturnType<typeof classifyComplaint>>;
    }
  | {
      kind: "created";
      complaintId: string;
      complaintCode: string;
      classification: Awaited<ReturnType<typeof classifyComplaint>>;
      assignedPic: { id: string; full_name: string; whatsapp_phone: string | null } | null;
      picNotification: string | null;
      complainantAck: string;
    };

/**
 * Core intake pipeline. Returns an IntakeOutcome describing what happened
 * so the demo console can surface every step to the operator.
 */
export async function processIncomingComplaint(
  msg: IncomingMessage
): Promise<IntakeOutcome> {
  const sb = createAdminClient();

  // Always log the inbound message for audit
  await sb.from("complaint_messages").insert({
    complaint_id: null,
    direction: "incoming",
    channel: "whatsapp",
    sender_phone: msg.phone,
    message_text: msg.text,
    message_type: msg.evidenceUrl ? "image" : "text",
    raw_payload_json: { evidenceUrl: msg.evidenceUrl ?? null },
  });

  // Conversation memory: if the current message has no evidence, look back
  // for a recent unresolved message from the same phone that DID include
  // evidence. WhatsApp users naturally split a complaint across multiple
  // messages (photo first, then location in reply), so we stitch them back
  // together here. We also concatenate prior text so the classifier sees
  // the full context (e.g. "projektor tak function" + "dkb1" -> location=dkb1).
  let evidenceUrl = msg.evidenceUrl ?? null;
  let workingText = msg.text;
  const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000).toISOString();

  if (!evidenceUrl) {
    const { data: recent } = await sb
      .from("complaint_messages")
      .select("message_text, raw_payload_json")
      .eq("sender_phone", msg.phone)
      .eq("direction", "incoming")
      .is("complaint_id", null)
      .gte("created_at", TEN_MIN_AGO)
      .order("created_at", { ascending: false })
      .limit(5);

    const priorWithMedia = (recent ?? []).find(
      (m) => (m.raw_payload_json as any)?.evidenceUrl
    );
    if (priorWithMedia) {
      evidenceUrl = (priorWithMedia.raw_payload_json as any).evidenceUrl;
      const priorText = (priorWithMedia.message_text || "").trim();
      // Combine prior + current so Claude sees both together
      workingText = priorText
        ? `${priorText}. ${msg.text}`.trim()
        : msg.text;
    }
  }

  // Step 2: must have evidence (current message or recent context)
  if (!evidenceUrl) {
    const reply = Templates.evidenceRequest();
    await sendWhatsApp({ to: msg.phone, body: reply });
    return { kind: "evidence_required", replySent: reply };
  }

  // Step 3: classify with combined text
  const classification = await classifyComplaint(workingText, msg.imageDescription);

  if (classification.needs_followup || !classification.category) {
    const reply =
      classification.followup_question ||
      "Boleh berikan sedikit maklumat tambahan tentang aduan ini?";
    await sendWhatsApp({ to: msg.phone, body: reply });
    return { kind: "followup", replySent: reply, classification };
  }

  // Step 4: lookup assigned PIC
  const category = classification.category as Category;
  const { data: assignment } = await sb
    .from("category_pic_assignments")
    .select("pic_user_id")
    .eq("category", category)
    .maybeSingle();

  let pic: { id: string; full_name: string; whatsapp_phone: string | null } | null = null;
  if (assignment?.pic_user_id) {
    const { data: picRow } = await sb
      .from("users")
      .select("id, full_name, whatsapp_phone, is_active")
      .eq("id", assignment.pic_user_id)
      .maybeSingle();
    if (picRow?.is_active) {
      pic = {
        id: picRow.id,
        full_name: picRow.full_name,
        whatsapp_phone: picRow.whatsapp_phone,
      };
    }
  }

  // Step 5: create complaint
  const initialStatus: Status = STATUSES[0];
  const { data: created, error: insertErr } = await sb
    .from("complaints")
    .insert({
      complainant_phone: msg.phone,
      original_message: workingText,
      ai_summary: classification.summary,
      category,
      location: classification.location,
      assigned_pic_user_id: pic?.id ?? null,
      status: initialStatus,
      evidence_file_url: evidenceUrl,
      ai_confidence: classification.confidence,
      source_channel: "whatsapp",
    })
    .select("id, complaint_code")
    .single();

  if (insertErr || !created) {
    throw new Error(`Failed to create complaint: ${insertErr?.message}`);
  }

  // Backfill the inbound messages (current + any earlier unresolved ones from
  // this phone in the last 10 min) so they all link to the new complaint.
  await sb
    .from("complaint_messages")
    .update({ complaint_id: created.id })
    .is("complaint_id", null)
    .eq("sender_phone", msg.phone)
    .eq("direction", "incoming")
    .gte("created_at", TEN_MIN_AGO);

  // Step 6a: ack complainant
  const ack = Templates.ticketCreatedToComplainant(created.complaint_code);
  await sendWhatsAppSafe({ to: msg.phone, body: ack });

  // Twilio sandbox throttles tightly — pause before the next outbound message
  // so the second send isn't dropped silently.
  await sleep(1500);

  // Step 6b: notify PIC
  let picNotification: string | null = null;
  if (pic?.whatsapp_phone) {
    picNotification = Templates.picNotification({
      code: created.complaint_code,
      category,
      location: classification.location,
      summary: classification.summary,
      complainantPhone: msg.phone,
    });
    await sendWhatsAppSafe({ to: pic.whatsapp_phone, body: picNotification });
  }

  return {
    kind: "created",
    complaintId: created.id,
    complaintCode: created.complaint_code,
    classification,
    assignedPic: pic,
    picNotification,
    complainantAck: ack,
  };
}

/**
 * Apply a status command from a PIC's WhatsApp reply or the dashboard.
 * Returns the new status (or null if the command was unrecognized).
 */
export async function applyStatusCommand(opts: {
  complaintId: string;
  newStatus: Status;
  changedByUserId?: string | null;
  changeSource: "whatsapp" | "dashboard" | "system";
  overrideReason?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("complaints")
    .select("id, complaint_code, status, complainant_phone")
    .eq("id", opts.complaintId)
    .single();
  if (!existing) throw new Error("Complaint not found");

  if (existing.status === opts.newStatus) return;

  const { error } = await sb
    .from("complaints")
    .update({ status: opts.newStatus })
    .eq("id", opts.complaintId);
  if (error) throw error;

  // The DB trigger inserts a system log; overwrite/augment it with the
  // explicit source + reason so admin overrides are auditable.
  await sb.from("complaint_status_logs").insert({
    complaint_id: opts.complaintId,
    old_status: existing.status,
    new_status: opts.newStatus,
    changed_by_user_id: opts.changedByUserId ?? null,
    change_source: opts.changeSource,
    override_reason: opts.overrideReason ?? null,
  });

  if (opts.newStatus === "Selesai") {
    await sendWhatsAppSafe({
      to: existing.complainant_phone,
      body: Templates.closureToComplainant(),
    });
    // Pause before the caller's next outbound (PIC ack) so Twilio doesn't drop it.
    await sleep(1500);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wrapper around sendWhatsApp that never throws — failures are logged so a
 * single rate-limited message doesn't break the rest of the intake flow.
 */
async function sendWhatsAppSafe(msg: { to: string; body: string }): Promise<void> {
  try {
    const r = await sendWhatsApp(msg);
    if (!r.ok) {
      console.warn(`[intake] WhatsApp send failed -> ${msg.to}: ${r.error}`);
    }
  } catch (err) {
    console.warn(`[intake] WhatsApp send threw -> ${msg.to}:`, err);
  }
}

const COMMAND_MAP: Record<string, Status> = {
  TERIMA: "Diterima",
  "DALAM TINDAKAN": "Dalam Tindakan",
  SELESAI: "Selesai",
};

export function parsePicCommand(text: string): Status | null {
  const norm = text.trim().toUpperCase().replace(/\s+/g, " ");
  return COMMAND_MAP[norm] ?? null;
}

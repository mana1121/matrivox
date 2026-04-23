import { createAdminClient } from "@/lib/supabase/admin";
import { classifyComplaint } from "@/lib/ai/classifier";
import { sendWhatsApp, Templates, type BotIntent } from "@/lib/whatsapp";
import { STATUSES, type Category, type Status } from "@/lib/types";

export type IncomingMessage = {
  phone: string;
  text: string;
  evidenceUrl?: string | null;
  imageDescription?: string;
};

export type IntakeOutcome =
  | { kind: "awaiting_location"; replySent: string }
  | { kind: "awaiting_photo"; replySent: string }
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

const CONVERSATION_WINDOW_MIN = 15;

/** Send a message and tag it with a conversation intent in the log. */
async function sendAndLog(
  sb: ReturnType<typeof createAdminClient>,
  to: string,
  body: string,
  intent: BotIntent,
): Promise<string> {
  await sendWhatsAppSafe({ to, body });
  await sb.from("complaint_messages").insert({
    complaint_id: null,
    direction: "outgoing",
    channel: "whatsapp",
    sender_phone: to,
    message_text: body,
    message_type: "text",
    raw_payload_json: { bot_intent: intent },
  });
  return body;
}

/** Look up the stage of an in-flight conversation for this phone number. */
async function getConversationStage(
  sb: ReturnType<typeof createAdminClient>,
  phone: string,
): Promise<"new" | "awaiting_location" | "awaiting_photo"> {
  const windowAgo = new Date(
    Date.now() - CONVERSATION_WINDOW_MIN * 60_000,
  ).toISOString();
  const { data } = await sb
    .from("complaint_messages")
    .select("direction, raw_payload_json, created_at")
    .eq("sender_phone", phone)
    .eq("direction", "outgoing")
    .is("complaint_id", null)
    .gte("created_at", windowAgo)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastIntent = (data?.[0]?.raw_payload_json as { bot_intent?: BotIntent } | null)
    ?.bot_intent;
  if (lastIntent === "asked_location") return "awaiting_location";
  if (lastIntent === "asked_photo") return "awaiting_photo";
  return "new";
}

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

  // ─── GUIDED CONVERSATION STATE MACHINE ─────────────────────────────
  // Stage 1 (new): first message → warm ack + ask for location.
  // Stage 2 (awaiting_location): reply received → ask for photo.
  // Stage 3 (awaiting_photo): photo (or "TIADA") → finalize ticket.
  const stage = await getConversationStage(sb, msg.phone);

  if (stage === "new") {
    const reply = await sendAndLog(
      sb,
      msg.phone,
      Templates.initialAckAskLocation(),
      "asked_location",
    );
    return { kind: "awaiting_location", replySent: reply };
  }

  if (stage === "awaiting_location") {
    // User has now told us the location. Next we need a photo.
    const reply = await sendAndLog(
      sb,
      msg.phone,
      Templates.askPhoto(),
      "asked_photo",
    );
    return { kind: "awaiting_photo", replySent: reply };
  }

  // Stage: awaiting_photo — only finalize if we actually have a photo now
  // (either in the current message or stitched from a prior inbound within
  // the conversation window), or if the user explicitly opted out via
  // "TIADA". Otherwise nudge again.
  const windowAgo = new Date(
    Date.now() - CONVERSATION_WINDOW_MIN * 60_000,
  ).toISOString();

  // Stitch all prior inbound text + media for this conversation window.
  const { data: recentInbound } = await sb
    .from("complaint_messages")
    .select("message_text, raw_payload_json, created_at")
    .eq("sender_phone", msg.phone)
    .eq("direction", "incoming")
    .is("complaint_id", null)
    .gte("created_at", windowAgo)
    .order("created_at", { ascending: true });

  let evidenceUrl = msg.evidenceUrl ?? null;
  const priorTexts: string[] = [];
  for (const m of recentInbound ?? []) {
    const t = (m.message_text || "").trim();
    if (t) priorTexts.push(t);
    const prev = (m.raw_payload_json as { evidenceUrl?: string | null } | null)
      ?.evidenceUrl;
    if (!evidenceUrl && prev) evidenceUrl = prev;
  }
  const workingText = priorTexts.join(". ").trim() || msg.text;

  const optedOut = /^\s*TIADA\s*$/i.test(msg.text || "");
  if (!evidenceUrl && !optedOut) {
    const reply = await sendAndLog(
      sb,
      msg.phone,
      Templates.photoReminder(),
      "asked_photo",
    );
    return { kind: "awaiting_photo", replySent: reply };
  }

  // All set — classify and finalize the ticket.
  const classification = await classifyComplaint(workingText, msg.imageDescription);
  const category: Category = (classification.category as Category) || "Fasiliti";

  // Step 4: lookup assigned PIC
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

  // Backfill ALL messages (inbound + our guiding outbound) from this phone
  // in the conversation window so the complaint thread shows the full chat.
  await sb
    .from("complaint_messages")
    .update({ complaint_id: created.id })
    .is("complaint_id", null)
    .eq("sender_phone", msg.phone)
    .gte("created_at", windowAgo);

  // Step 6a: warm ack to complainant — includes PIC name + ETA
  const ack = Templates.ticketCreatedToComplainant({
    code: created.complaint_code,
    category,
    location: classification.location,
    picName: pic?.full_name ?? null,
  });
  await sendWhatsAppSafe({ to: msg.phone, body: ack });

  // Step 6b: notify PIC — forward the evidence photo when available so
  // the PIC can triage straight from WhatsApp without opening the dashboard.
  let picNotification: string | null = null;
  if (pic?.whatsapp_phone) {
    picNotification = Templates.picNotification({
      code: created.complaint_code,
      category,
      location: classification.location,
      summary: classification.summary,
      complainantPhone: msg.phone,
    });
    await sendWhatsAppSafe({
      to: pic.whatsapp_phone,
      body: picNotification,
      mediaUrl: evidenceUrl ?? undefined,
    });
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
  /** Optional note from the PIC — shown to the complainant in the update. */
  picRemark?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("complaints")
    .select(
      "id, complaint_code, status, complainant_phone, assigned_pic_user_id"
    )
    .eq("id", opts.complaintId)
    .single();
  if (!existing) throw new Error("Complaint not found");

  if (existing.status === opts.newStatus) return;

  const { error } = await sb
    .from("complaints")
    .update({ status: opts.newStatus })
    .eq("id", opts.complaintId);
  if (error) throw error;

  await sb.from("complaint_status_logs").insert({
    complaint_id: opts.complaintId,
    old_status: existing.status,
    new_status: opts.newStatus,
    changed_by_user_id: opts.changedByUserId ?? null,
    change_source: opts.changeSource,
    // Reuse override_reason as the transition note — covers both admin
    // overrides and PIC remarks (migration can rename later).
    override_reason: opts.overrideReason ?? opts.picRemark ?? null,
  });

  // Warm Journey: every transition sends a comforting message to the
  // complainant so they feel progress throughout the lifecycle.
  let picName: string | null = null;
  if (existing.assigned_pic_user_id) {
    const { data: picRow } = await sb
      .from("users")
      .select("full_name")
      .eq("id", existing.assigned_pic_user_id)
      .maybeSingle();
    picName = picRow?.full_name ?? null;
  }

  if (opts.newStatus === "Dalam Tindakan") {
    await sendWhatsAppSafe({
      to: existing.complainant_phone,
      body: Templates.inProgressToComplainant({
        code: existing.complaint_code,
        picName,
        picRemark: opts.picRemark ?? null,
      }),
    });
  } else if (opts.newStatus === "Selesai") {
    await sendWhatsAppSafe({
      to: existing.complainant_phone,
      body: Templates.closureToComplainant(
        existing.complaint_code,
        opts.picRemark ?? null,
      ),
    });
  }
}

/**
 * Wrapper around sendWhatsApp that never throws — failures are logged so a
 * single rate-limited message doesn't break the rest of the intake flow.
 */
async function sendWhatsAppSafe(msg: {
  to: string;
  body: string;
  mediaUrl?: string;
}): Promise<void> {
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

// Ordered longest-first so "DALAM TINDAKAN" matches before "DALAM".
const COMMAND_KEYS = Object.keys(COMMAND_MAP).sort((a, b) => b.length - a.length);

/**
 * Parse a PIC WhatsApp command. Supports an optional trailing remark:
 *   "SELESAI paip telah diganti"        -> { status: "Selesai", remark: "paip telah diganti" }
 *   "DALAM TINDAKAN saya dalam 1 jam"   -> { status: "Dalam Tindakan", remark: "saya dalam 1 jam" }
 *   "TERIMA"                             -> { status: "Diterima",     remark: null }
 */
export function parsePicCommand(
  text: string,
): { status: Status; remark: string | null } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase().replace(/\s+/g, " ");
  for (const cmd of COMMAND_KEYS) {
    if (upper === cmd) return { status: COMMAND_MAP[cmd], remark: null };
    if (upper.startsWith(cmd + " ")) {
      // Slice from the original text preserving case; use normalized length.
      const normalizedTrimmed = trimmed.replace(/\s+/g, " ");
      const remark = normalizedTrimmed.slice(cmd.length).trim();
      return { status: COMMAND_MAP[cmd], remark: remark || null };
    }
  }
  return null;
}

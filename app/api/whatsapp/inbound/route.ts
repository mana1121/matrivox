import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyStatusCommand,
  parsePicCommand,
  processIncomingComplaint,
} from "@/lib/intake";
import { Templates, sendWhatsApp } from "@/lib/whatsapp";

/**
 * Unified inbound endpoint — handles three payload formats:
 *
 *   1) Demo Console (JSON): { phone, text, evidenceDataUrl?, imageDescription? }
 *   2) Twilio WhatsApp     : application/x-www-form-urlencoded
 *                            (From, Body, NumMedia, MediaUrl0, MediaContentType0…)
 *   3) Meta WhatsApp Cloud : nested JSON under entry[].changes[].value.messages[]
 *
 * Behavior is the same regardless of source:
 *   - PIC commands (TERIMA / DALAM TINDAKAN / SELESAI) update the most recent
 *     open complaint for that PIC's category.
 *   - Anything else runs through `processIncomingComplaint`.
 */

type NormalizedInbound = {
  phone: string;
  text: string;
  evidenceUrl: string | null;
  imageDescription?: string;
};

export async function POST(req: Request) {
  let normalized: NormalizedInbound | null = null;
  try {
    normalized = await normalizeInbound(req);
  } catch (err) {
    console.error("[inbound] normalize failed:", err);
    return NextResponse.json({ error: "Could not parse payload" }, { status: 400 });
  }

  if (!normalized || !normalized.phone) {
    return NextResponse.json({ ok: true, kind: "ignored" });
  }

  // Image-only message (no caption) — treat as a complaint with a placeholder
  // text so the classifier + intake pipeline can still create a ticket.
  if (!normalized.text && normalized.evidenceUrl) {
    normalized.text = "Aduan dengan gambar (tiada keterangan).";
  }

  if (!normalized.text) {
    return NextResponse.json({ ok: true, kind: "ignored" });
  }

  const { phone, text } = normalized;

  // Step A: PIC command path (parses "SELESAI <remark>" etc.)
  const cmd = parsePicCommand(text);
  if (cmd) {
    const sb = createAdminClient();
    const { data: pic } = await sb
      .from("users")
      .select("id, role, category_assigned, full_name, is_active")
      .eq("whatsapp_phone", phone)
      .eq("role", "pic")
      .eq("is_active", true)
      .maybeSingle();

    if (pic) {
      const { data: target } = await sb
        .from("complaints")
        .select("id, complaint_code, status")
        .eq("category", pic.category_assigned)
        .neq("status", "Selesai")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!target) {
        await sendWhatsApp({
          to: phone,
          body: "Tiada aduan terbuka untuk kategori anda buat masa ini.",
        });
        return NextResponse.json({ ok: true, kind: "pic_no_open_ticket" });
      }

      await applyStatusCommand({
        complaintId: target.id,
        newStatus: cmd.status,
        changedByUserId: pic.id,
        changeSource: "whatsapp",
        picRemark: cmd.remark,
      });

      // Warm ack to the PIC — confirms the complainant has been notified
      // (where applicable) so the PIC feels their work is visible.
      try {
        const r = await sendWhatsApp({
          to: phone,
          body: Templates.picStatusAck({
            code: target.complaint_code,
            status: cmd.status,
            complainantNotified:
              cmd.status === "Dalam Tindakan" || cmd.status === "Selesai",
          }),
        });
        if (!r.ok) console.warn(`[wa] PIC ack send failed -> ${phone}: ${r.error}`);
      } catch (err) {
        console.warn(`[wa] PIC ack send threw -> ${phone}:`, err);
      }

      return NextResponse.json({
        ok: true,
        kind: "pic_command_applied",
        complaint_code: target.complaint_code,
        new_status: cmd.status,
        pic_remark: cmd.remark,
      });
    }
    // sender isn't a PIC — fall through to complaint intake
  }

  const outcome = await processIncomingComplaint({
    phone,
    text,
    evidenceUrl: normalized.evidenceUrl,
    imageDescription: normalized.imageDescription,
  });

  return NextResponse.json(outcome);
}

// ---------------------------------------------------------------------------
// Payload normalization — branches on Content-Type and shape
// ---------------------------------------------------------------------------

async function normalizeInbound(req: Request): Promise<NormalizedInbound | null> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  // Twilio: application/x-www-form-urlencoded (or multipart for media)
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await req.formData();
    return await fromTwilioForm(form);
  }

  // JSON body (Demo Console or Meta)
  const json = await req.json();

  // Meta WhatsApp Cloud API webhook
  if (json && typeof json === "object" && (json as any).object === "whatsapp_business_account") {
    return await fromMetaPayload(json);
  }

  // Demo Console — accept either a hosted URL or a base64 data URL
  const phone = String(json.phone || "").trim();
  const text = String(json.text || "").trim();
  let evidenceUrl: string | null = null;
  if (typeof json.evidenceDataUrl === "string" && json.evidenceDataUrl.length > 0) {
    if (json.evidenceDataUrl.startsWith("data:")) {
      evidenceUrl = await uploadBytesToStorage(
        Buffer.from(json.evidenceDataUrl.replace(/^data:.+?;base64,/, ""), "base64"),
        json.evidenceDataUrl.match(/^data:(.+?);base64,/)?.[1] || "image/jpeg",
        phone
      );
    } else {
      evidenceUrl = json.evidenceDataUrl;
    }
  }
  return {
    phone,
    text,
    evidenceUrl,
    imageDescription: json.imageDescription,
  };
}

function stripWhatsappPrefix(s: string): string {
  return s.replace(/^whatsapp:/i, "").trim();
}

async function fromTwilioForm(form: FormData): Promise<NormalizedInbound> {
  const phone = stripWhatsappPrefix(String(form.get("From") || ""));
  const text = String(form.get("Body") || "").trim();
  const numMedia = parseInt(String(form.get("NumMedia") || "0"), 10) || 0;

  let evidenceUrl: string | null = null;
  if (numMedia > 0) {
    const mediaUrl = String(form.get("MediaUrl0") || "");
    const mediaContentType = String(form.get("MediaContentType0") || "image/jpeg");
    if (mediaUrl) {
      evidenceUrl = await fetchTwilioMediaToStorage(mediaUrl, mediaContentType, phone);
    }
  }

  return { phone, text, evidenceUrl };
}

async function fromMetaPayload(payload: any): Promise<NormalizedInbound | null> {
  try {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    const rawPhone = String(message.from || "").trim();
    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

    let text = "";
    let mediaId: string | null = null;
    let mediaMime = "image/jpeg";

    if (message.type === "text") {
      text = String(message.text?.body || "").trim();
    } else if (message.type === "image") {
      text = String(message.image?.caption || "").trim();
      mediaId = String(message.image?.id || "") || null;
      mediaMime = String(message.image?.mime_type || "image/jpeg");
    }

    let evidenceUrl: string | null = null;
    if (mediaId) {
      evidenceUrl = await fetchMetaMediaToStorage(mediaId, mediaMime, phone);
    }

    return { phone, text, evidenceUrl };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Media fetchers — both download with provider auth, then re-upload to
// Supabase storage so the public URL we save in the complaint row is stable.
// ---------------------------------------------------------------------------

async function fetchTwilioMediaToStorage(
  mediaUrl: string,
  contentTypeHint: string,
  phone: string
): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.warn("[twilio-media] missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN");
    return null;
  }
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${auth}` },
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(`[twilio-media] fetch ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") || contentTypeHint;
    const bytes = Buffer.from(await res.arrayBuffer());
    return await uploadBytesToStorage(bytes, ct, phone);
  } catch (err) {
    console.warn("[twilio-media] threw:", err);
    return null;
  }
}

async function fetchMetaMediaToStorage(
  mediaId: string,
  mimeHint: string,
  phone: string
): Promise<string | null> {
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("[meta-media] missing META_WA_ACCESS_TOKEN");
    return null;
  }
  try {
    // Meta requires a 2-step download: GET media metadata → GET URL it returns.
    const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      console.warn(`[meta-media] metadata fetch ${metaRes.status}`);
      return null;
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;
    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      console.warn(`[meta-media] file fetch ${fileRes.status}`);
      return null;
    }
    const ct = fileRes.headers.get("content-type") || meta.mime_type || mimeHint;
    const bytes = Buffer.from(await fileRes.arrayBuffer());
    return await uploadBytesToStorage(bytes, ct, phone);
  } catch (err) {
    console.warn("[meta-media] threw:", err);
    return null;
  }
}

async function uploadBytesToStorage(
  bytes: Buffer,
  contentType: string,
  phone: string
): Promise<string | null> {
  try {
    const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
    const sb = createAdminClient();
    const path = `inbound/${phone.replace(/[^\w+]/g, "")}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("evidence").upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.warn("[upload] failed:", error.message);
      return null;
    }
    const { data } = sb.storage.from("evidence").getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch (err) {
    console.warn("[upload] threw:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET — Meta webhook handshake + health check
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Meta WhatsApp Cloud API webhook subscription handshake
  if (mode === "subscribe" && token && challenge) {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET || "matrivox-demo";
    if (token === expected) {
      return new Response(challenge, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response("forbidden", { status: 403 });
  }

  return NextResponse.json({ ok: true, service: "matrivox-whatsapp-inbound" });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyStatusCommand,
  parsePicCommand,
  processIncomingComplaint,
} from "@/lib/intake";
import { Templates, sendWhatsApp } from "@/lib/whatsapp";

/**
 * Unified inbound endpoint — usable by:
 * 1) The Demo Console (POST JSON: { phone, text, evidenceDataUrl?, imageDescription? })
 * 2) Real WhatsApp providers (after a thin adapter normalizes their payload).
 *
 * Behavior:
 * - If sender phone matches an active PIC and the text is a status command,
 *   apply the command to the PIC's most recent open complaint.
 * - Otherwise, run the complaint intake pipeline.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone: string = String(body.phone || "").trim();
  const text: string = String(body.text || "").trim();
  if (!phone || !text) {
    return NextResponse.json({ error: "phone & text are required" }, { status: 400 });
  }

  // Step A: PIC command path
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
      // Find the most recent open complaint for this PIC's category
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
        newStatus: cmd,
        changedByUserId: pic.id,
        changeSource: "whatsapp",
      });

      await sendWhatsApp({
        to: phone,
        body: Templates.statusAck(target.complaint_code, cmd),
      });

      return NextResponse.json({
        ok: true,
        kind: "pic_command_applied",
        complaint_code: target.complaint_code,
        new_status: cmd,
      });
    }
    // sender isn't a PIC — fall through to complaint intake
  }

  // Step B: complaint intake. Resolve evidence URL — for the demo we can
  // accept either a remote URL or a base64 data URL (we upload it to Storage).
  let evidenceUrl: string | null = null;
  if (typeof body.evidenceDataUrl === "string" && body.evidenceDataUrl.length > 0) {
    if (body.evidenceDataUrl.startsWith("data:")) {
      evidenceUrl = await uploadDataUrlToStorage(body.evidenceDataUrl, phone);
    } else {
      evidenceUrl = body.evidenceDataUrl;
    }
  }

  const outcome = await processIncomingComplaint({
    phone,
    text,
    evidenceUrl,
    imageDescription: body.imageDescription,
  });

  return NextResponse.json(outcome);
}

async function uploadDataUrlToStorage(dataUrl: string, phone: string): Promise<string | null> {
  try {
    const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!m) return dataUrl;
    const mime = m[1];
    const ext = mime.split("/")[1]?.split(";")[0] || "bin";
    const bytes = Buffer.from(m[2], "base64");
    const sb = createAdminClient();
    const path = `inbound/${phone.replace(/[^\w+]/g, "")}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("evidence").upload(path, bytes, {
      contentType: mime,
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

export async function GET() {
  // Convenience for provider verification (Meta uses GET hub challenge).
  return NextResponse.json({ ok: true, service: "matrivox-whatsapp-inbound" });
}

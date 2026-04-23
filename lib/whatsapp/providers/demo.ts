import type { OutgoingMessage, SendResult, WhatsAppProvider } from "../types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Demo provider: persists outgoing messages to complaint_messages so the
 * Demo Console (and complaint detail page) can render the WhatsApp log
 * without a real provider. Includes light console logging.
 */
export const demoProvider: WhatsAppProvider = {
  name: "demo",
  async send(msg: OutgoingMessage): Promise<SendResult> {
    const id = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      `[wa:demo] -> ${msg.to}: ${msg.body}${msg.mediaUrl ? ` [media: ${msg.mediaUrl}]` : ""}`
    );
    try {
      const sb = createAdminClient();
      await sb.from("complaint_messages").insert({
        complaint_id: null,
        direction: "outgoing",
        channel: "whatsapp",
        sender_phone: msg.to,
        message_text: msg.body,
        message_type: msg.mediaUrl ? "image" : "text",
        raw_payload_json: { provider: "demo", id, mediaUrl: msg.mediaUrl ?? null },
      });
    } catch (err) {
      console.warn("[wa:demo] failed to log outgoing message:", err);
    }
    return { ok: true, providerMessageId: id };
  },
};

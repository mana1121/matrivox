import type { OutgoingMessage, SendResult, WhatsAppProvider } from "../types";

export const metaProvider: WhatsAppProvider = {
  name: "meta",
  async send(msg: OutgoingMessage): Promise<SendResult> {
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
    const token = process.env.META_WA_ACCESS_TOKEN;
    if (!phoneId || !token) {
      return { ok: false, error: "Meta WA env vars missing" };
    }
    const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: msg.to,
        type: "text",
        text: { body: msg.body },
      }),
    });
    if (!res.ok) return { ok: false, error: `Meta ${res.status}` };
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { ok: true, providerMessageId: data.messages?.[0]?.id };
  },
};

import type { OutgoingMessage, SendResult, WhatsAppProvider } from "../types";

export const twilioProvider: WhatsAppProvider = {
  name: "twilio",
  async send(msg: OutgoingMessage): Promise<SendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !from) {
      return { ok: false, error: "Twilio env vars missing" };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${msg.to}`,
      Body: msg.body,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) return { ok: false, error: `Twilio ${res.status}` };
    const data = (await res.json()) as { sid?: string };
    return { ok: true, providerMessageId: data.sid };
  },
};

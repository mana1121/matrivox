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
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(`[wa:twilio] send failed ${res.status} -> ${msg.to}: ${errBody.slice(0, 300)}`);
      return { ok: false, error: `Twilio ${res.status}: ${errBody.slice(0, 200)}` };
    }
    const data = (await res.json()) as { sid?: string };
    console.log(`[wa:twilio] sent ${data.sid} -> ${msg.to}`);
    return { ok: true, providerMessageId: data.sid };
  },
};

import twilio from "twilio";
import type { OutgoingMessage, SendResult, WhatsAppProvider } from "../types";

// Minimum gap between outbound sends. Twilio sandbox enforces ~1 msg/sec;
// production WhatsApp senders start at ~80 msg/sec but Meta may throttle
// bursts. 1100ms is safe for sandbox, generous for production.
const MIN_GAP_MS = Number(process.env.TWILIO_MIN_GAP_MS || 1100);
const MAX_RETRIES = Number(process.env.TWILIO_MAX_RETRIES || 3);

// Serialize all outbound sends through a single promise chain so intake.ts
// no longer needs manual sleep() calls between messages.
let queue: Promise<unknown> = Promise.resolve();
let lastSentAt = 0;

type TwilioClient = ReturnType<typeof twilio>;

function getClient(): TwilioClient | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendWithRetry(
  client: TwilioClient,
  from: string,
  msg: OutgoingMessage,
): Promise<SendResult> {
  // Enforce minimum gap since the last successful or failed send.
  const wait = Math.max(0, lastSentAt + MIN_GAP_MS - Date.now());
  if (wait > 0) await sleep(wait);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await client.messages.create({
        from: `whatsapp:${from}`,
        to: `whatsapp:${msg.to}`,
        body: msg.body,
      });
      lastSentAt = Date.now();
      console.log(`[wa:twilio] sent ${data.sid} -> ${msg.to}`);
      return { ok: true, providerMessageId: data.sid };
    } catch (err: unknown) {
      const e = err as { status?: number; code?: number; message?: string };
      const isRateLimit = e.status === 429 || e.code === 20429 || e.code === 63018;
      const isTransient = e.status === 503 || e.status === 504;

      if ((isRateLimit || isTransient) && attempt < MAX_RETRIES) {
        const backoff = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        console.warn(
          `[wa:twilio] ${isRateLimit ? "rate limit" : "transient"} (${e.status ?? e.code}); retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`,
        );
        await sleep(backoff);
        continue;
      }

      lastSentAt = Date.now();
      const errorMsg = e.message || String(err);
      console.warn(`[wa:twilio] send failed -> ${msg.to}: ${errorMsg}`);
      return { ok: false, error: `Twilio: ${errorMsg}` };
    }
  }

  return { ok: false, error: "Twilio: exhausted retries" };
}

export const twilioProvider: WhatsAppProvider = {
  name: "twilio",
  async send(msg: OutgoingMessage): Promise<SendResult> {
    const client = getClient();
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!client || !from) {
      return { ok: false, error: "Twilio env vars missing" };
    }

    // Chain onto the queue so sends execute one at a time, in order.
    const task = queue.then(() => sendWithRetry(client, from, msg));
    queue = task.catch(() => {}); // swallow errors so one failure doesn't poison the chain
    return task;
  },
};

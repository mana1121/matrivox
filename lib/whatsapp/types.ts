export type OutgoingMessage = {
  to: string;
  body: string;
  /** Optional public URL of an image/media to attach (e.g. evidence photo). */
  mediaUrl?: string;
};

export type SendResult = {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
};

export interface WhatsAppProvider {
  name: "demo" | "twilio" | "meta";
  send(msg: OutgoingMessage): Promise<SendResult>;
}

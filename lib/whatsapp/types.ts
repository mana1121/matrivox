export type OutgoingMessage = {
  to: string;
  body: string;
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

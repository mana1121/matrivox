import type { OutgoingMessage, SendResult, WhatsAppProvider } from "./types";
import { demoProvider } from "./providers/demo";
import { twilioProvider } from "./providers/twilio";
import { metaProvider } from "./providers/meta";

export function getProvider(): WhatsAppProvider {
  const name = (process.env.WHATSAPP_PROVIDER || "demo").toLowerCase();
  switch (name) {
    case "twilio":
      return twilioProvider;
    case "meta":
      return metaProvider;
    case "demo":
    default:
      return demoProvider;
  }
}

export async function sendWhatsApp(msg: OutgoingMessage): Promise<SendResult> {
  return getProvider().send(msg);
}

/** Templated copy used across the app — single source of truth. */
export const Templates = {
  evidenceRequest: () =>
    "Salam. Untuk membuat aduan menerusi Matrivox, sila lampirkan gambar atau tangkap layar sebagai bukti visual. Terima kasih.",
  followUp: (q: string) => q,
  ticketCreatedToComplainant: (code: string) =>
    `Aduan anda diterima.\n\nNo. rujukan: ${code}\nStatus: Diterima\n\nKami akan kemaskini melalui WhatsApp.`,
  picNotification: (opts: {
    code: string;
    category: string;
    location: string | null;
    summary: string;
    complainantPhone: string;
  }) =>
    `🛎️ Aduan baharu Matrivox\n\n` +
    `No: ${opts.code}\n` +
    `Kategori: ${opts.category}\n` +
    `Lokasi: ${opts.location || "Tidak dinyatakan"}\n` +
    `Ringkasan: ${opts.summary}\n` +
    `Pengadu: ${opts.complainantPhone}\n\n` +
    `Balas dengan:\n` +
    `• TERIMA — sahkan menerima\n` +
    `• DALAM TINDAKAN — kerja sedang dilakukan\n` +
    `• SELESAI — aduan selesai`,
  closureToComplainant: () =>
    "Aduan anda telah diselesaikan. Terima kasih kerana menggunakan Matrivox.",
  statusAck: (code: string, status: string) =>
    `Status aduan ${code} dikemaskini kepada: ${status}.`,
};

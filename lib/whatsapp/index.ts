import type { OutgoingMessage, SendResult, WhatsAppProvider } from "./types";
import { demoProvider } from "./providers/demo";
import { twilioProvider } from "./providers/twilio";
import { metaProvider } from "./providers/meta";
import type { Status } from "@/lib/types";

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

/**
 * Templated copy — the "Warm Journey" framework.
 *
 * Every message is written to make the sender feel heard, and the PIC feel
 * supported. Tone: calm, respectful, slightly caring — not robotic.
 */
export const Templates = {
  evidenceRequest: () =>
    "Salam. Terima kasih kerana menghubungi Matrivox. Untuk membantu kami memahami aduan anda dengan lebih baik, bolehkah lampirkan gambar atau tangkap layar? Terima kasih. 🙏",

  followUp: (q: string) => q,

  // ─── COMPLAINANT JOURNEY ─────────────────────────────────────────────
  // T1: ticket created — warm welcome with code, PIC name, and ETA
  ticketCreatedToComplainant: (opts: {
    code: string;
    category: string;
    location: string | null;
    picName: string | null;
  }) => {
    const picLine = opts.picName
      ? `👤 Pegawai bertugas: *${opts.picName}*`
      : `👤 Pegawai bertugas akan dimaklumkan tidak lama lagi.`;
    const locLine = opts.location ? `📍 Lokasi: ${opts.location}\n` : "";
    return (
      `Salam. Aduan anda telah kami terima dengan baik. 🙏\n\n` +
      `📋 No. rujukan: *${opts.code}*\n` +
      `📂 Kategori: ${opts.category}\n` +
      `${locLine}` +
      `${picLine}\n` +
      `⏱️ Kami akan kemaskini anda dalam masa 24 jam.\n\n` +
      `Terima kasih kerana membantu kami memperbaiki kampus bersama-sama.`
    );
  },

  // T3: status moved to "Dalam Tindakan" — show progress, reassure
  inProgressToComplainant: (opts: { code: string; picName: string | null }) =>
    `🔧 Kemas kini aduan *${opts.code}*\n\n` +
    (opts.picName ? `${opts.picName} kini sedang menguruskan aduan anda. ` : `Aduan anda kini dalam tindakan. `) +
    `Terima kasih atas kesabaran anda. 🙏`,

  // T4: resolved — invite re-engagement, end on warmth
  closureToComplainant: (code: string) =>
    `✅ Aduan *${code}* telah diselesaikan.\n\n` +
    `Terima kasih kerana membantu kami memperbaiki kampus. ` +
    `Jika isu masih berlaku atau anda ingin berkongsi maklum balas, ` +
    `sila balas mesej ini. 💬`,

  // T5: comfort nudge — for complaints stuck >24h (cron-driven, future)
  comfortNudge: (code: string) =>
    `Salam. Kami ingin memaklumkan bahawa aduan *${code}* masih dalam semakan. ` +
    `Kami memohon maaf atas kelewatan dan sedang menyusulinya. ` +
    `Terima kasih atas kesabaran anda. 🙏`,

  // ─── PIC JOURNEY ─────────────────────────────────────────────────────
  // P0: new complaint assigned to PIC
  picNotification: (opts: {
    code: string;
    category: string;
    location: string | null;
    summary: string;
    complainantPhone: string;
  }) =>
    `🛎️ *Aduan baharu Matrivox*\n\n` +
    `📋 No: *${opts.code}*\n` +
    `📂 Kategori: ${opts.category}\n` +
    `📍 Lokasi: ${opts.location || "Tidak dinyatakan"}\n` +
    `📝 Ringkasan: ${opts.summary}\n` +
    `📞 Pengadu: ${opts.complainantPhone}\n\n` +
    `Balas dengan:\n` +
    `• *TERIMA* — sahkan menerima\n` +
    `• *DALAM TINDAKAN* — kerja sedang dilakukan\n` +
    `• *SELESAI* — aduan selesai\n\n` +
    `Terima kasih atas khidmat anda. 🙏`,

  // P1–P3: ack to PIC after they update status (with confirmation that
  // the complainant has been notified where applicable)
  picStatusAck: (opts: { code: string; status: Status; complainantNotified: boolean }) => {
    const header = `✓ Status aduan *${opts.code}* dikemaskini kepada *${opts.status}*.`;
    if (opts.status === "Selesai") {
      return (
        `${header}\n\nPengadu telah dimaklumkan. ` +
        `Terima kasih atas khidmat cemerlang anda. 🙏`
      );
    }
    if (opts.status === "Dalam Tindakan") {
      return (
        `${header}\n\nPengadu telah dimaklumkan bahawa kerja sedang dilakukan. ` +
        `Terima kasih.`
      );
    }
    return `${header}\n\nTerima kasih.`;
  },
};

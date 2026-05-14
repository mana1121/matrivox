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

/** Conversation stages we track for the guided WhatsApp intake flow. */
export type BotIntent = "asked_location" | "asked_photo" | "done";

/**
 * Templated copy — the "Warm Journey" framework.
 *
 * Every message is written to make the sender feel heard, and the PIC feel
 * supported. Tone: calm, respectful, slightly caring — not robotic.
 */
export const Templates = {
  // ─── GUIDED INTAKE (conversational) ──────────────────────────────────
  // Turn 1 — warm ack + ask for precise location.
  // Personalized when sender is a registered student.
  initialAckAskLocation: (complainantName: string | null = null) =>
    (complainantName
      ? `Salam *${complainantName}*. Aduan anda kami terima dengan baik. 🙏`
      : `Salam. Aduan anda kami terima dengan baik. 🙏`) +
    `\n\n` +
    `Untuk membolehkan kami bertindak dengan tepat, boleh nyatakan lokasi sebenar aduan ini?\n\n` +
    `Contoh: _Bilik Tutorial 3, Aras 2_ atau _Tandas Lelaki Blok A_.`,

  // Turn 2 — ask for photo
  askPhoto: () =>
    `Terima kasih atas maklumat. 📍\n\n` +
    `Seterusnya, sila lampirkan *gambar* sebagai bukti supaya pegawai bertugas dapat memahami masalah dengan lebih jelas. 📷`,

  // Turn 2b — user replied after "asked_photo" but without a photo
  photoReminder: () =>
    `Kami masih menunggu gambar anda. Sila lampirkan satu foto sebagai bukti aduan. 📷\n\n` +
    `Jika sukar untuk mengambil gambar, balas *TIADA* dan kami akan teruskan tanpa bukti visual.`,

  // Legacy (kept for demo console backward compatibility)
  evidenceRequest: () =>
    "Salam. Terima kasih kerana menghubungi Matrivox. Untuk membantu kami memahami aduan anda dengan lebih baik, bolehkah lampirkan gambar atau tangkap layar? Terima kasih. 🙏",

  followUp: (q: string) => q,

  // ─── COMPLAINANT JOURNEY ─────────────────────────────────────────────
  // T1: ticket created — warm welcome with code, PIC name, and ETA.
  // If the sender is a registered student, greet them by name.
  ticketCreatedToComplainant: (opts: {
    code: string;
    category: string;
    location: string | null;
    picName: string | null;
    complainantName: string | null;
  }) => {
    const picLine = opts.picName
      ? `👤 Pegawai bertugas: *${opts.picName}*`
      : `👤 Pegawai bertugas akan dimaklumkan tidak lama lagi.`;
    const locLine = opts.location ? `📍 Lokasi: ${opts.location}\n` : "";
    const greeting = opts.complainantName
      ? `Salam *${opts.complainantName}*. Aduan anda telah kami terima dengan baik. 🙏`
      : `Salam. Aduan anda telah kami terima dengan baik. 🙏`;
    return (
      `${greeting}\n\n` +
      `📋 No. rujukan: *${opts.code}*\n` +
      `📂 Kategori: ${opts.category}\n` +
      `${locLine}` +
      `${picLine}\n` +
      `⏱️ Kami akan kemaskini anda dalam masa 24 jam.\n\n` +
      `Terima kasih kerana membantu kami memperbaiki kampus bersama-sama.`
    );
  },

  // T3: status moved to "Dalam Tindakan" — show progress, reassure
  inProgressToComplainant: (opts: {
    code: string;
    picName: string | null;
    picRemark: string | null;
  }) =>
    `🔧 Kemas kini aduan *${opts.code}*\n\n` +
    (opts.picName
      ? `${opts.picName} kini sedang menguruskan aduan anda.`
      : `Aduan anda kini dalam tindakan.`) +
    (opts.picRemark ? `\n\n📝 Nota: ${opts.picRemark}` : "") +
    `\n\nTerima kasih atas kesabaran anda. 🙏`,

  // T4: resolved — invite re-engagement, end on warmth
  closureToComplainant: (code: string, picRemark: string | null) =>
    `✅ Aduan *${code}* telah diselesaikan.\n\n` +
    (picRemark ? `📝 Tindakan diambil: ${picRemark}\n\n` : "") +
    `Terima kasih kerana membantu kami memperbaiki kampus. ` +
    `Jika isu masih berlaku atau anda ingin berkongsi maklum balas, ` +
    `sila balas mesej ini. 💬`,

  // T5: comfort nudge — for complaints stuck >24h (cron-driven, future)
  comfortNudge: (code: string) =>
    `Salam. Kami ingin memaklumkan bahawa aduan *${code}* masih dalam semakan. ` +
    `Kami memohon maaf atas kelewatan dan sedang menyusulinya. ` +
    `Terima kasih atas kesabaran anda. 🙏`,

  // ─── PIC JOURNEY ─────────────────────────────────────────────────────
  // P0: new complaint assigned to PIC.
  // Includes student identity when the sender is registered.
  picNotification: (opts: {
    code: string;
    category: string;
    location: string | null;
    summary: string;
    complainantPhone: string;
    complainantName?: string | null;
    complainantMatric?: string | null;
    complainantIc?: string | null;
    complainantRole?: string | null;
  }) => {
    const identityLines: string[] = [];
    if (opts.complainantName) {
      identityLines.push(`👤 Pengadu: *${opts.complainantName}*`);
      if (opts.complainantRole) identityLines.push(`   Peranan: ${opts.complainantRole}`);
      if (opts.complainantMatric) identityLines.push(`   Matrik: ${opts.complainantMatric}`);
      if (opts.complainantIc) identityLines.push(`   No. KP: ${opts.complainantIc}`);
      identityLines.push(`   📞 ${opts.complainantPhone}`);
    } else {
      identityLines.push(`📞 Pengadu: ${opts.complainantPhone} _(tidak berdaftar)_`);
    }
    return (
      `🛎️ *Aduan baharu Matrivox*\n\n` +
      `📋 No: *${opts.code}*\n` +
      `📂 Kategori: ${opts.category}\n` +
      `📍 Lokasi: ${opts.location || "Tidak dinyatakan"}\n` +
      `📝 Ringkasan: ${opts.summary}\n` +
      identityLines.join("\n") +
      `\n\nBalas dengan:\n` +
      `• *TERIMA* — sahkan menerima\n` +
      `• *DALAM TINDAKAN* — kerja sedang dilakukan\n` +
      `• *SELESAI* — aduan selesai\n\n` +
      `Terima kasih atas khidmat anda. 🙏`
    );
  },

  // Asked to PIC when they type "SELESAI" without a resolution note —
  // prompts them to describe the action taken before closing the ticket.
  picAskResolution: (code: string) =>
    `Terima kasih. Sebelum kami menutup aduan *${code}*, sila kongsi ringkasan tindakan yang telah diambil.\n\n` +
    `Contoh: _paip telah diganti, tandas kini boleh digunakan_.\n\n` +
    `Balasan anda akan dihantar kepada pengadu sebagai penyelesaian rasmi.`,

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

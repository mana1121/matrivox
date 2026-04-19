import Link from "next/link";
import { Card, CardHeader } from "@/components/Card";
import { CategoryBadge, StatusBadge } from "@/components/StatusBadge";
import StatusUpdater from "@/components/StatusUpdater";
import { formatDateTime } from "@/lib/utils";
import type { Complaint, AppUser } from "@/lib/types";

type StatusLog = {
  id: string;
  old_status: string | null;
  new_status: string;
  change_source: string;
  override_reason: string | null;
  created_at: string;
  changed_by_user_id: string | null;
};

type Message = {
  id: string;
  direction: "incoming" | "outgoing";
  message_text: string | null;
  message_type: string;
  sender_phone: string | null;
  created_at: string;
};

export default function ComplaintDetail({
  complaint,
  pic,
  logs,
  messages,
  me,
  backHref,
}: {
  complaint: Complaint;
  pic: { full_name: string; whatsapp_phone: string | null } | null;
  logs: StatusLog[];
  messages: Message[];
  me: AppUser;
  backHref: string;
}) {
  return (
    <main className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={backHref} className="text-xs text-slate-500 hover:underline">
            ← Kembali
          </Link>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            {complaint.complaint_code}
          </h2>
          <p className="text-sm text-slate-500">
            {formatDateTime(complaint.created_at)} · dari {complaint.complainant_phone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge category={complaint.category} />
          <StatusBadge status={complaint.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Mesej Asal" subtitle="Tidak boleh diubah" />
            <div className="px-5 py-4 text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
              {complaint.original_message}
            </div>
          </Card>

          <Card>
            <CardHeader title="Ringkasan AI" />
            <div className="px-5 py-4 text-sm text-slate-800">
              <p>{complaint.ai_summary ?? "—"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <dt className="text-slate-500">Lokasi</dt>
                  <dd className="text-slate-800">{complaint.location ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Keyakinan AI</dt>
                  <dd className="text-slate-800">
                    {complaint.ai_confidence != null
                      ? `${Math.round(Number(complaint.ai_confidence) * 100)}%`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          {complaint.evidence_file_url && (
            <Card>
              <CardHeader title="Bukti Visual" />
              <div className="px-5 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={complaint.evidence_file_url}
                  alt="Bukti aduan"
                  className="max-h-96 rounded-lg border border-slate-200 object-contain"
                />
                <a
                  href={complaint.evidence_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-brand-700 hover:underline"
                >
                  Buka asal →
                </a>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Mesej WhatsApp" subtitle="Inbound & outbound bagi aduan ini" />
            <ul className="px-5 py-4 space-y-3 text-sm">
              {messages.length === 0 && (
                <li className="text-slate-500">Tiada mesej direkodkan.</li>
              )}
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-prose rounded-lg px-3 py-2 ring-1 ${
                    m.direction === "incoming"
                      ? "bg-slate-50 ring-slate-200"
                      : "ml-auto bg-emerald-50 ring-emerald-200"
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    {m.direction === "incoming" ? "Masuk" : "Keluar"} ·{" "}
                    {formatDateTime(m.created_at)}{" "}
                    {m.sender_phone && <>· {m.sender_phone}</>}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-800">
                    {m.message_text}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="PIC Bertugas" />
            <div className="px-5 py-4 text-sm">
              {pic ? (
                <>
                  <div className="font-medium text-slate-900">{pic.full_name}</div>
                  <div className="text-slate-600">{pic.whatsapp_phone ?? "Tiada nombor"}</div>
                </>
              ) : (
                <div className="text-slate-500">Belum ditetapkan.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Kemaskini Status" />
            <div className="px-5 py-4">
              <StatusUpdater
                complaintId={complaint.id}
                current={complaint.status}
                isAdmin={me.role === "admin"}
              />
              {me.role === "pic" && (
                <p className="mt-3 text-xs text-slate-500">
                  PIC juga boleh kemaskini melalui WhatsApp dengan menghantar{" "}
                  <code>TERIMA</code>, <code>DALAM TINDAKAN</code>, atau <code>SELESAI</code>.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Log Status" />
            <ol className="px-5 py-4 space-y-3 text-sm">
              {logs.length === 0 && <li className="text-slate-500">Tiada log lagi.</li>}
              {logs.map((l) => (
                <li key={l.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0">
                    <div className="text-slate-800">
                      {l.old_status ? `${l.old_status} → ` : "Dicipta · "}
                      <span className="font-medium">{l.new_status}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(l.created_at)} · {l.change_source}
                    </div>
                    {l.override_reason && (
                      <div className="mt-1 text-xs text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded px-2 py-1">
                        Sebab override: {l.override_reason}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </main>
  );
}

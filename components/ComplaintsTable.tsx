"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryBadge, StatusBadge } from "@/components/StatusBadge";
import { CATEGORIES, STATUSES, type Category, type Status } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type Row = {
  id: string;
  complaint_code: string;
  created_at: string;
  complainant_phone: string;
  category: Category | null;
  location: string | null;
  ai_summary: string | null;
  status: Status;
  assigned_pic_name?: string | null;
};

export default function ComplaintsTable({
  rows,
  basePath,
  showPic = true,
}: {
  rows: Row[];
  basePath: string;
  showPic?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"" | Category>("");
  const [status, setStatus] = useState<"" | Status>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 3600 * 1000 - 1 : null;
    return rows.filter((r) => {
      if (cat && r.category !== cat) return false;
      if (status && r.status !== status) return false;
      const t = new Date(r.created_at).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      if (!qq) return true;
      return (
        r.complaint_code.toLowerCase().includes(qq) ||
        (r.location ?? "").toLowerCase().includes(qq) ||
        (r.ai_summary ?? "").toLowerCase().includes(qq) ||
        r.complainant_phone.toLowerCase().includes(qq)
      );
    });
  }, [rows, q, cat, status, from, to]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-200">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-600">Cari</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="No, lokasi, ringkasan, telefon…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Kategori</label>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value as any)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Semua</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Semua</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Dari</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Hingga</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div className="ml-auto text-xs text-slate-500">{filtered.length} aduan</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="table-cell">No</th>
              <th className="table-cell">Tarikh</th>
              <th className="table-cell">Telefon</th>
              <th className="table-cell">Kategori</th>
              <th className="table-cell">Lokasi</th>
              <th className="table-cell">Ringkasan</th>
              {showPic && <th className="table-cell">PIC</th>}
              <th className="table-cell">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showPic ? 8 : 7} className="table-cell text-center text-slate-500">
                  Tiada hasil sepadan dengan tapisan.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="table-cell">
                  <Link href={`${basePath}/${r.id}`} className="font-medium text-brand-700">
                    {r.complaint_code}
                  </Link>
                </td>
                <td className="table-cell text-slate-600 whitespace-nowrap">
                  {formatDateTime(r.created_at)}
                </td>
                <td className="table-cell text-slate-600">{r.complainant_phone}</td>
                <td className="table-cell">
                  <CategoryBadge category={r.category} />
                </td>
                <td className="table-cell text-slate-600">{r.location ?? "—"}</td>
                <td className="table-cell text-slate-600 max-w-xs truncate">
                  {r.ai_summary ?? "—"}
                </td>
                {showPic && (
                  <td className="table-cell text-slate-600">{r.assigned_pic_name ?? "—"}</td>
                )}
                <td className="table-cell">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

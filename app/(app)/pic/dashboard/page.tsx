import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import { Card, CardHeader, StatCard } from "@/components/Card";
import { CategoryBadge, StatusBadge } from "@/components/StatusBadge";
import { dailyTrend, statusCounts } from "@/lib/analytics";
import { formatDateTime } from "@/lib/utils";
import TrendChart from "@/components/charts/TrendChart";

export const dynamic = "force-dynamic";

export default async function PicDashboard() {
  const me = await requireRole("pic");
  const sb = createClient();

  // RLS already restricts to category, but we filter explicitly for clarity.
  const { data: complaints } = await sb
    .from("complaints")
    .select("id, complaint_code, created_at, category, status, location, ai_summary, complainant_phone")
    .eq("category", me.category_assigned)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = complaints ?? [];
  const recent = rows.slice(0, 8);
  const stats = statusCounts(rows as any);
  const trend = dailyTrend(rows as any, 7);

  const open = stats.find((s) => s.status === "Diterima")?.count ?? 0;
  const inProgress = stats.find((s) => s.status === "Dalam Tindakan")?.count ?? 0;
  const done = stats.find((s) => s.status === "Selesai")?.count ?? 0;

  return (
    <>
      <TopBar user={me} title={`Aduan ${me.category_assigned ?? "—"}`} />
      <main className="p-6 space-y-6">
        {!me.category_assigned && (
          <Card className="p-4 bg-amber-50 border-amber-200 text-amber-900 text-sm">
            Akaun anda belum ditetapkan kepada mana-mana kategori. Sila hubungi admin.
          </Card>
        )}

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Jumlah" value={rows.length} accent="brand" />
          <StatCard label="Diterima" value={open} accent="amber" />
          <StatCard label="Dalam Tindakan" value={inProgress} accent="blue" />
          <StatCard label="Selesai" value={done} accent="emerald" />
        </div>

        <div className="grid gap-4 grid-cols-1 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Aduan Diterima — 7 Hari" />
            <TrendChart data={trend} />
          </Card>
          <Card>
            <CardHeader title="Status Ringkasan" />
            <ul className="px-5 py-4 space-y-3">
              {stats.map((s) => (
                <li key={s.status} className="flex items-center justify-between">
                  <StatusBadge status={s.status} />
                  <span className="text-sm font-semibold text-slate-800">{s.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Aduan Terkini"
            action={
              <Link
                href="/pic/complaints"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Lihat semua →
              </Link>
            }
          />
          <div className="overflow-x-auto px-2 pb-3 pt-2">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="table-cell">No</th>
                  <th className="table-cell">Tarikh</th>
                  <th className="table-cell">Lokasi</th>
                  <th className="table-cell">Ringkasan</th>
                  <th className="table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-cell text-center text-slate-500">
                      Tiada aduan baharu untuk kategori anda.
                    </td>
                  </tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <Link href={`/pic/complaints/${r.id}`} className="font-medium text-brand-700">
                        {r.complaint_code}
                      </Link>
                    </td>
                    <td className="table-cell text-slate-600">{formatDateTime(r.created_at)}</td>
                    <td className="table-cell text-slate-600">{r.location ?? "—"}</td>
                    <td className="table-cell text-slate-600 max-w-xs truncate">
                      {r.ai_summary ?? r.complainant_phone}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}

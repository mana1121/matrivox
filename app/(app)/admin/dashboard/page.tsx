import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import { Card, CardHeader, StatCard } from "@/components/Card";
import { CategoryBadge, StatusBadge } from "@/components/StatusBadge";
import { categoryCounts, dailyTrend, statusCounts, weeklyTrend } from "@/lib/analytics";
import { formatDateTime } from "@/lib/utils";
import TrendChart from "@/components/charts/TrendChart";
import CategoryBarChart from "@/components/charts/CategoryBarChart";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const me = await requireAdmin();
  const sb = createClient();

  const { data: complaints } = await sb
    .from("complaints")
    .select("id, complaint_code, created_at, category, status, location, ai_summary, complainant_phone")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = complaints ?? [];
  const recent = rows.slice(0, 8);

  const cats = categoryCounts(rows as any);
  const stats = statusCounts(rows as any);
  const week = dailyTrend(rows as any, 7);
  const month = weeklyTrend(rows as any, 8);

  const total = rows.length;
  const open = stats.find((s) => s.status === "Diterima")?.count ?? 0;
  const inProgress = stats.find((s) => s.status === "Dalam Tindakan")?.count ?? 0;
  const done = stats.find((s) => s.status === "Selesai")?.count ?? 0;

  return (
    <>
      <TopBar user={me} title="Papan Pemuka Admin" />
      <main className="p-6 space-y-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Jumlah Aduan" value={total} accent="brand" hint="Sepanjang masa" />
          <StatCard label="Diterima" value={open} accent="amber" hint="Belum diambil tindakan" />
          <StatCard label="Dalam Tindakan" value={inProgress} accent="blue" />
          <StatCard label="Selesai" value={done} accent="emerald" />
        </div>

        <div className="grid gap-4 grid-cols-1 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Trend Mingguan" subtitle="7 hari terakhir" />
            <TrendChart data={week} />
          </Card>
          <Card>
            <CardHeader title="Aduan Mengikut Kategori" subtitle="Sepanjang masa" />
            <CategoryBarChart data={cats} />
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-1 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Trend Bulanan" subtitle="8 minggu terakhir" />
            <TrendChart data={month} />
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
                href="/admin/complaints"
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
                  <th className="table-cell">Kategori</th>
                  <th className="table-cell">Lokasi</th>
                  <th className="table-cell">Ringkasan</th>
                  <th className="table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-cell text-center text-slate-500">
                      Tiada aduan lagi. Cuba simulasi dari{" "}
                      <Link href="/admin/demo" className="text-brand-700 underline">
                        Demo Console
                      </Link>
                      .
                    </td>
                  </tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <Link href={`/admin/complaints/${r.id}`} className="font-medium text-brand-700">
                        {r.complaint_code}
                      </Link>
                    </td>
                    <td className="table-cell text-slate-600">{formatDateTime(r.created_at)}</td>
                    <td className="table-cell">
                      <CategoryBadge category={r.category} />
                    </td>
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

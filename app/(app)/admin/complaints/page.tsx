import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import ComplaintsTable from "@/components/ComplaintsTable";

export const dynamic = "force-dynamic";

export default async function AdminComplaintsPage() {
  const me = await requireAdmin();
  const sb = createClient();

  const { data } = await sb
    .from("complaints")
    .select(
      `id, complaint_code, created_at, complainant_phone, category, location, ai_summary, status,
       assigned_pic:assigned_pic_user_id(full_name)`
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    assigned_pic_name: r.assigned_pic?.full_name ?? null,
  }));

  return (
    <>
      <TopBar user={me} title="Senarai Aduan" />
      <main className="p-6">
        <ComplaintsTable rows={rows as any} basePath="/admin/complaints" />
      </main>
    </>
  );
}

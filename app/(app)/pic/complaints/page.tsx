import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import ComplaintsTable from "@/components/ComplaintsTable";

export const dynamic = "force-dynamic";

export default async function PicComplaintsPage() {
  const me = await requireRole("pic");
  const sb = createClient();

  const { data } = await sb
    .from("complaints")
    .select("id, complaint_code, created_at, complainant_phone, category, location, ai_summary, status")
    .eq("category", me.category_assigned)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <>
      <TopBar user={me} title={`Aduan ${me.category_assigned ?? ""}`} />
      <main className="p-6">
        <ComplaintsTable rows={(data ?? []) as any} basePath="/pic/complaints" showPic={false} />
      </main>
    </>
  );
}

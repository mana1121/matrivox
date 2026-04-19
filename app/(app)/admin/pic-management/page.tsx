import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import { Card, CardHeader } from "@/components/Card";
import PicManagementClient from "./PicManagementClient";

export const dynamic = "force-dynamic";

export default async function PicManagementPage() {
  const me = await requireAdmin();
  const sb = createClient();

  const { data: pics } = await sb
    .from("users")
    .select("id, full_name, email, role, category_assigned, whatsapp_phone, is_active")
    .eq("role", "pic")
    .order("created_at", { ascending: true });

  const { data: assignments } = await sb
    .from("category_pic_assignments")
    .select("category, pic_user_id");

  return (
    <>
      <TopBar user={me} title="Pengurusan PIC" />
      <main className="p-6 space-y-6">
        <Card>
          <CardHeader
            title="PIC Akaun"
            subtitle="Cipta, ubah, atau nyahaktifkan akaun PIC. Setiap kategori boleh ada 1 PIC."
          />
          <div className="px-5 py-4">
            <PicManagementClient
              pics={(pics ?? []) as any}
              assignments={(assignments ?? []) as any}
            />
          </div>
        </Card>
      </main>
    </>
  );
}

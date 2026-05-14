import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import { Card, CardHeader } from "@/components/Card";
import StudentsClient from "./StudentsClient";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const me = await requireAdmin();
  const sb = createClient();

  const { data: students } = await sb
    .from("students")
    .select(
      "id, full_name, ic_number, matric_number, whatsapp_phone, email, role, is_active",
    )
    .order("created_at", { ascending: false });

  return (
    <>
      <TopBar user={me} title="Pendaftaran Pelajar / Staf" />
      <main className="p-6 space-y-6">
        <Card>
          <CardHeader
            title="Profil Pengadu Berdaftar"
            subtitle="Daftar nombor WhatsApp pelajar/staf supaya sistem mengenali mereka dan PIC dapat butiran penuh."
          />
          <div className="px-5 py-4">
            <StudentsClient students={(students ?? []) as any} />
          </div>
        </Card>
      </main>
    </>
  );
}

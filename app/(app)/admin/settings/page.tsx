import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import { Card, CardHeader } from "@/components/Card";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdmin();
  const sb = createClient();

  const { data: settings } = await sb.from("system_settings").select("*");
  const { data: pics } = await sb
    .from("users")
    .select("id, full_name, email, category_assigned")
    .eq("role", "pic")
    .eq("is_active", true);
  const { data: assignments } = await sb
    .from("category_pic_assignments")
    .select("category, pic_user_id");

  const map = new Map<string, any>();
  (settings ?? []).forEach((s) => map.set(s.key, s.value_json));

  return (
    <>
      <TopBar user={me} title="Tetapan Sistem" />
      <main className="p-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pemetaan Kategori → PIC" subtitle="Setiap kategori mempunyai 1 PIC." />
          <div className="px-5 py-4">
            <SettingsClient.Mapping pics={(pics ?? []) as any} assignments={(assignments ?? []) as any} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Mod & Penyedia WhatsApp" subtitle="Tetapan paparan untuk demo." />
          <div className="px-5 py-4">
            <SettingsClient.WhatsApp
              demoMode={map.get("demo_mode") === true || map.get("demo_mode") === "true"}
              provider={String(map.get("whatsapp_provider") ?? "demo")}
              businessNumber={String(map.get("whatsapp_business_number") ?? "")}
            />
          </div>
        </Card>
      </main>
    </>
  );
}

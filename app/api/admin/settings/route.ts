import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  const updates: Array<{ key: string; value_json: any }> = [];
  if ("demo_mode" in body) updates.push({ key: "demo_mode", value_json: !!body.demo_mode });
  if ("whatsapp_provider" in body)
    updates.push({ key: "whatsapp_provider", value_json: String(body.whatsapp_provider) });
  if ("whatsapp_business_number" in body)
    updates.push({
      key: "whatsapp_business_number",
      value_json: String(body.whatsapp_business_number),
    });

  for (const u of updates) {
    await admin.from("system_settings").upsert(u, { onConflict: "key" });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES, type Category } from "@/lib/types";

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
  const category = body.category as Category;
  const pic_user_id: string | null = body.pic_user_id || null;
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Kategori tidak sah." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!pic_user_id) {
    await admin.from("category_pic_assignments").delete().eq("category", category);
    // Also clear category_assigned on the previously-assigned user
    return NextResponse.json({ ok: true });
  }

  // Verify target is a PIC
  const { data: target } = await admin
    .from("users")
    .select("id, role")
    .eq("id", pic_user_id)
    .maybeSingle();
  if (!target || target.role !== "pic") {
    return NextResponse.json({ error: "Pengguna bukan PIC." }, { status: 400 });
  }

  // Upsert mapping
  await admin
    .from("category_pic_assignments")
    .upsert({ category, pic_user_id }, { onConflict: "category" });
  // Mirror onto users.category_assigned
  await admin.from("users").update({ category_assigned: category }).eq("id", pic_user_id);

  return NextResponse.json({ ok: true });
}

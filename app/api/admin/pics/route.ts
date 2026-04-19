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
  const full_name: string = (body.full_name || "").trim();
  const email: string = (body.email || "").trim().toLowerCase();
  const password: string = body.password || "";
  const whatsapp_phone: string = (body.whatsapp_phone || "").trim();
  const category_assigned = body.category_assigned as Category | undefined;

  if (!full_name || !email || !password || password.length < 8 || !whatsapp_phone) {
    return NextResponse.json(
      { error: "Sila isi semua medan. Kata laluan minimum 8 aksara." },
      { status: 400 }
    );
  }
  if (category_assigned && !CATEGORIES.includes(category_assigned)) {
    return NextResponse.json({ error: "Kategori tidak sah." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: "pic" },
  });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message || "Gagal cipta akaun." },
      { status: 400 }
    );
  }

  // Update mirrored row
  await admin.from("users").upsert({
    id: created.user.id,
    email,
    full_name,
    role: "pic",
    whatsapp_phone,
    category_assigned: category_assigned ?? null,
    is_active: true,
  });

  // Assign category mapping (1 PIC per category — replaces existing)
  if (category_assigned) {
    await admin
      .from("category_pic_assignments")
      .upsert(
        { category: category_assigned, pic_user_id: created.user.id },
        { onConflict: "category" }
      );
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}

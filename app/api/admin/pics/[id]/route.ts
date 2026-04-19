import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES, type Category } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.full_name === "string") patch.full_name = body.full_name.trim();
  if (typeof body.whatsapp_phone === "string")
    patch.whatsapp_phone = body.whatsapp_phone.trim();
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (body.category_assigned === null) patch.category_assigned = null;
  else if (typeof body.category_assigned === "string") {
    if (!CATEGORIES.includes(body.category_assigned as Category)) {
      return NextResponse.json({ error: "Kategori tidak sah." }, { status: 400 });
    }
    patch.category_assigned = body.category_assigned;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("users").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Sync category_pic_assignments
  if (patch.category_assigned !== undefined) {
    // Remove any existing mapping for this PIC
    await admin.from("category_pic_assignments").delete().eq("pic_user_id", params.id);
    if (patch.category_assigned) {
      await admin
        .from("category_pic_assignments")
        .upsert(
          { category: patch.category_assigned as Category, pic_user_id: params.id },
          { onConflict: "category" }
        );
    }
  }

  return NextResponse.json({ ok: true });
}

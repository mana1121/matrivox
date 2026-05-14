import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["pelajar", "staff", "pensyarah"] as const;

function normalizePhone(raw: string): string {
  const digits = (raw || "").trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("60")) return "+" + digits;
  if (digits.startsWith("0")) return "+60" + digits.slice(1);
  return "+" + digits;
}

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
  if (typeof body.ic_number === "string") patch.ic_number = body.ic_number.trim() || null;
  if (typeof body.matric_number === "string")
    patch.matric_number = body.matric_number.trim() || null;
  if (typeof body.whatsapp_phone === "string")
    patch.whatsapp_phone = normalizePhone(body.whatsapp_phone);
  if (typeof body.email === "string") patch.email = body.email.trim().toLowerCase() || null;
  if (typeof body.role === "string" && (ROLES as readonly string[]).includes(body.role))
    patch.role = body.role;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  const admin = createAdminClient();
  const { error } = await admin.from("students").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

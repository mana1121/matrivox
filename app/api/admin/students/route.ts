import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["pelajar", "staff", "pensyarah"] as const;

function normalizePhone(raw: string): string {
  // Accept "0182174500" or "+60182174500" or "60182174500" -> "+60182174500"
  const digits = (raw || "").trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("60")) return "+" + digits;
  if (digits.startsWith("0")) return "+60" + digits.slice(1);
  return "+" + digits;
}

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
  const ic_number: string | null = body.ic_number ? String(body.ic_number).trim() : null;
  const matric_number: string | null = body.matric_number
    ? String(body.matric_number).trim()
    : null;
  const whatsapp_phone: string = normalizePhone(String(body.whatsapp_phone || ""));
  const email: string | null = body.email ? String(body.email).trim().toLowerCase() : null;
  const role = (ROLES as readonly string[]).includes(body.role) ? body.role : "pelajar";

  if (!full_name || !whatsapp_phone || whatsapp_phone.length < 8) {
    return NextResponse.json(
      { error: "Nama dan No. WhatsApp wajib diisi." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("students")
    .insert({
      full_name,
      ic_number,
      matric_number,
      whatsapp_phone,
      email,
      role,
      is_active: true,
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json(
      { error: error.message.includes("duplicate") ? "Nombor ini sudah berdaftar." : error.message },
      { status: 400 },
    );

  return NextResponse.json({ ok: true, id: data.id });
}

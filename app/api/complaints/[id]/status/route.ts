import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyStatusCommand } from "@/lib/intake";
import { STATUSES, type Status } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await sb
    .from("users")
    .select("role, category_assigned")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const status = body.status as Status;
  const reason: string | null = body.override_reason ?? null;

  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Read complaint to enforce category check for PICs
  const { data: complaint } = await sb
    .from("complaints")
    .select("id, status, category")
    .eq("id", params.id)
    .maybeSingle();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (profile.role === "pic" && complaint.category !== profile.category_assigned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (profile.role === "admin" && status !== complaint.status && !reason?.trim()) {
    return NextResponse.json(
      { error: "Override reason required for admin status changes." },
      { status: 400 }
    );
  }

  await applyStatusCommand({
    complaintId: complaint.id,
    newStatus: status,
    changedByUserId: user.id,
    changeSource: "dashboard",
    overrideReason: profile.role === "admin" ? reason : null,
  });

  return NextResponse.json({ ok: true });
}

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import ComplaintDetail from "@/components/ComplaintDetail";

export const dynamic = "force-dynamic";

export default async function PicComplaintDetail({ params }: { params: { id: string } }) {
  const me = await requireRole("pic");
  const sb = createClient();

  const { data: complaint } = await sb
    .from("complaints")
    .select("*")
    .eq("id", params.id)
    .eq("category", me.category_assigned) // RLS would also enforce
    .maybeSingle();
  if (!complaint) notFound();

  let pic: { full_name: string; whatsapp_phone: string | null } | null = null;
  if (complaint.assigned_pic_user_id) {
    const { data } = await sb
      .from("users")
      .select("full_name, whatsapp_phone")
      .eq("id", complaint.assigned_pic_user_id)
      .maybeSingle();
    pic = data as any;
  }

  const { data: logs } = await sb
    .from("complaint_status_logs")
    .select("*")
    .eq("complaint_id", complaint.id)
    .order("created_at", { ascending: true });

  const { data: messages } = await sb
    .from("complaint_messages")
    .select("id, direction, message_text, message_type, sender_phone, created_at")
    .eq("complaint_id", complaint.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <TopBar user={me} title={`Aduan ${complaint.complaint_code}`} />
      <ComplaintDetail
        complaint={complaint as any}
        pic={pic}
        logs={(logs ?? []) as any}
        messages={(messages ?? []) as any}
        me={me}
        backHref="/pic/complaints"
      />
    </>
  );
}

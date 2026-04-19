import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootIndex() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  redirect(profile?.role === "admin" ? "/admin/dashboard" : "/pic/dashboard");
}

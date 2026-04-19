import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Role } from "./types";

/** Get the current authenticated user with their public.users profile. Redirects to /login if missing. */
export async function getCurrentUser(): Promise<AppUser> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("users")
    .select("id, email, full_name, role, category_assigned, whatsapp_phone, is_active")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  return profile as AppUser;
}

export async function requireRole(role: Role): Promise<AppUser> {
  const me = await getCurrentUser();
  if (me.role !== role) {
    redirect(me.role === "admin" ? "/admin/dashboard" : "/pic/dashboard");
  }
  return me;
}

export async function requireAdmin(): Promise<AppUser> {
  return requireRole("admin");
}

"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const sb = createClient();
  return (
    <button
      onClick={async () => {
        await sb.auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
    >
      Log keluar
    </button>
  );
}

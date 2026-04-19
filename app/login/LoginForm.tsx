"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const sb = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    // Look up role to redirect
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setError("Tidak dapat mengesahkan sesi. Cuba lagi.");
      setSubmitting(false);
      return;
    }
    const { data: profile } = await sb
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    router.replace(profile?.role === "admin" ? "/admin/dashboard" : "/pic/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Emel</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          placeholder="nama@institusi.edu.my"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Kata laluan</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          autoComplete="current-password"
        />
      </div>
      {error && (
        <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Mengesahkan…" : "Log masuk"}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Lupa kata laluan? Hubungi pentadbir Matrivox.
      </p>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, type Status } from "@/lib/types";

export default function StatusUpdater({
  complaintId,
  current,
  isAdmin,
}: {
  complaintId: string;
  current: Status;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [next, setNext] = useState<Status>(current);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const isOverride = isAdmin && next !== current;
    if (isAdmin && isOverride && !reason.trim()) {
      setError("Sila berikan sebab override.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/complaints/${complaintId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: next,
          override_reason: isAdmin ? reason.trim() || null : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || `Gagal kemaskini (HTTP ${res.status})`);
        return;
      }
      setReason("");
      router.refresh();
    });
  }

  const changed = next !== current;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setNext(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
              next === s
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {isAdmin && changed && (
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Sebab override (wajib)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            placeholder="cth: PIC tidak responsif, eskalasi manual…"
          />
        </div>
      )}
      {error && (
        <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}
      <button
        disabled={!changed || pending}
        onClick={submit}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Mengemaskini…" : "Kemaskini Status"}
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/types";

type Pic = { id: string; full_name: string; email: string; category_assigned: Category | null };
type Assignment = { category: Category; pic_user_id: string };

function Mapping({ pics, assignments }: { pics: Pic[]; assignments: Assignment[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [state, setState] = useState<Record<Category, string>>(() => {
    const map: any = {};
    for (const c of CATEGORIES) {
      map[c] = assignments.find((a) => a.category === c)?.pic_user_id ?? "";
    }
    return map;
  });

  function save(category: Category) {
    setMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/settings/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, pic_user_id: state[category] || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j?.error || "Gagal simpan.");
      } else {
        setMsg(`Pemetaan ${category} disimpan.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {CATEGORIES.map((c) => (
        <div key={c} className="flex items-center gap-3">
          <span className="w-28 text-sm font-medium text-slate-700">{c}</span>
          <select
            value={state[c]}
            onChange={(e) => setState((s) => ({ ...s, [c]: e.target.value }))}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Tiada —</option>
            {pics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.email})
              </option>
            ))}
          </select>
          <button
            disabled={pending}
            onClick={() => save(c)}
            className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Simpan
          </button>
        </div>
      ))}
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </div>
  );
}

function WhatsApp({
  demoMode,
  provider,
  businessNumber,
}: {
  demoMode: boolean;
  provider: string;
  businessNumber: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [demo, setDemo] = useState(demoMode);
  const [prov, setProv] = useState(provider);
  const [num, setNum] = useState(businessNumber);
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demo_mode: demo,
          whatsapp_provider: prov,
          whatsapp_business_number: num,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j?.error || "Gagal simpan.");
      } else {
        setMsg("Tetapan disimpan.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => setDemo(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <span className="text-sm">Demo Mode aktif (simulasi WhatsApp dalam Demo Console)</span>
      </label>
      <div>
        <label className="block text-xs font-medium text-slate-600">Provider</label>
        <select
          value={prov}
          onChange={(e) => setProv(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="demo">demo (in-app log)</option>
          <option value="twilio">twilio</option>
          <option value="meta">meta</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Kunci sebenar perlu disetkan dalam <code>.env</code>.
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">No. WhatsApp Rasmi</label>
        <input
          value={num}
          onChange={(e) => setNum(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="+60123456789"
        />
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </div>
  );
}

const SettingsClient = { Mapping, WhatsApp };
export default SettingsClient;

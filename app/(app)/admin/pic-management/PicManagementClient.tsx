"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/types";

type Pic = {
  id: string;
  full_name: string;
  email: string;
  category_assigned: Category | null;
  whatsapp_phone: string | null;
  is_active: boolean;
};

type Assignment = { category: Category; pic_user_id: string };

export default function PicManagementClient({
  pics,
  assignments,
}: {
  pics: Pic[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Create form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<Category>("Kebersihan");

  function refresh() {
    router.refresh();
  }

  async function callApi(url: string, body: any, method = "POST") {
    setError(null);
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j?.error || `Ralat HTTP ${res.status}`);
        } else {
          refresh();
        }
        resolve();
      });
    });
  }

  async function createPic(e: React.FormEvent) {
    e.preventDefault();
    await callApi("/api/admin/pics", {
      full_name: fullName,
      email,
      password,
      whatsapp_phone: phone,
      category_assigned: category,
    });
    if (!error) {
      setOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setPhone("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Jumlah PIC: <span className="font-semibold text-slate-900">{pics.length}</span>
        </p>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          {open ? "Batal" : "+ Tambah PIC"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={createPic}
          className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Nama penuh</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Emel</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Kata laluan awal</label>
            <input
              required
              minLength={8}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">No. WhatsApp</label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+60123456789"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
            {error && (
              <div className="mr-auto rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Mencipta…" : "Cipta PIC"}
            </button>
          </div>
        </form>
      )}

      {error && !open && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50">
              <th className="table-cell">Nama</th>
              <th className="table-cell">Emel</th>
              <th className="table-cell">Kategori</th>
              <th className="table-cell">WhatsApp</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pics.length === 0 && (
              <tr>
                <td colSpan={6} className="table-cell text-center text-slate-500">
                  Tiada PIC. Cipta yang pertama.
                </td>
              </tr>
            )}
            {pics.map((p) => (
              <PicRow
                key={p.id}
                pic={p}
                assignedCategory={
                  assignments.find((a) => a.pic_user_id === p.id)?.category ??
                  p.category_assigned
                }
                onPatch={(body) => callApi(`/api/admin/pics/${p.id}`, body, "PATCH")}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PicRow({
  pic,
  assignedCategory,
  onPatch,
}: {
  pic: Pic;
  assignedCategory: Category | null;
  onPatch: (body: any) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(pic.whatsapp_phone ?? "");
  const [cat, setCat] = useState<Category>(
    assignedCategory ?? pic.category_assigned ?? "Kebersihan"
  );

  return (
    <tr className="hover:bg-slate-50">
      <td className="table-cell text-slate-900">{pic.full_name}</td>
      <td className="table-cell text-slate-600">{pic.email}</td>
      <td className="table-cell">
        {editing ? (
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value as Category)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : (
          assignedCategory ?? "—"
        )}
      </td>
      <td className="table-cell text-slate-600">
        {editing ? (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          />
        ) : (
          pic.whatsapp_phone ?? "—"
        )}
      </td>
      <td className="table-cell">
        {pic.is_active ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            Aktif
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            Nyahaktif
          </span>
        )}
      </td>
      <td className="table-cell">
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                onClick={async () => {
                  await onPatch({ whatsapp_phone: phone, category_assigned: cat });
                  setEditing(false);
                }}
                className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white"
              >
                Simpan
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs"
              >
                Batal
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                onClick={() => onPatch({ is_active: !pic.is_active })}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
              >
                {pic.is_active ? "Nyahaktif" : "Aktifkan"}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

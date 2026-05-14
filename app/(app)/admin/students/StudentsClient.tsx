"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Student, StudentRole } from "@/lib/types";

const ROLES: StudentRole[] = ["pelajar", "staff", "pensyarah"];

export default function StudentsClient({ students }: { students: Student[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  const [fullName, setFullName] = useState("");
  const [ic, setIc] = useState("");
  const [matric, setMatric] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StudentRole>("pelajar");

  function downloadSampleCsv() {
    const csv =
      "Nama,No. KP,No. Matrik,No. WhatsApp,Emel,Peranan\n" +
      "Hazman Jazimin,830708146527,MD0256789,+60102888897,hazman@kms.edu.my,pelajar\n" +
      "Siti Aminah,991201145623,MD0256790,0123456789,siti@kms.edu.my,pelajar\n" +
      "En Arif Razak,780115085522,,+60134606279,arif@kms.edu.my,staff\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matrivox-students-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadFile(file: File) {
    setError(null);
    setUploadSummary(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/students/bulk", {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || `Ralat HTTP ${res.status}`);
        if (j?.errors) {
          setUploadSummary({ imported: 0, skipped: j.errors.length, errors: j.errors });
        }
      } else {
        setUploadSummary({
          imported: j.imported ?? 0,
          skipped: j.skipped ?? 0,
          errors: j.errors ?? [],
        });
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Ralat ketika muat naik.");
    } finally {
      setUploading(false);
    }
  }

  async function callApi(url: string, body: any, method = "POST") {
    setError(null);
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j?.error || `Ralat HTTP ${res.status}`);
          resolve(false);
        } else {
          router.refresh();
          resolve(true);
        }
      });
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const ok = await callApi("/api/admin/students", {
      full_name: fullName,
      ic_number: ic,
      matric_number: matric,
      whatsapp_phone: phone,
      email,
      role,
    });
    if (ok) {
      setOpen(false);
      setFullName("");
      setIc("");
      setMatric("");
      setPhone("");
      setEmail("");
      setRole("pelajar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Jumlah berdaftar: <span className="font-semibold text-slate-900">{students.length}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadSampleCsv}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ⬇️ Sample CSV
          </button>
          <label className="cursor-pointer rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100">
            {uploading ? "Memuat naik…" : "📂 Upload Excel/CSV"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {open ? "Batal" : "+ Daftar Pengguna"}
          </button>
        </div>
      </div>

      {uploadSummary && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="font-semibold text-emerald-900">
            ✓ Selesai import — {uploadSummary.imported} berjaya, {uploadSummary.skipped} dilangkau
          </div>
          {uploadSummary.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-emerald-800">
                Lihat baris yang dilangkau ({uploadSummary.errors.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-rose-700">
                {uploadSummary.errors.map((e, i) => (
                  <li key={i}>
                    Baris {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {open && (
        <form
          onSubmit={create}
          className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Nama penuh *</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">No. KP</label>
            <input
              value={ic}
              onChange={(e) => setIc(e.target.value)}
              placeholder="830708146527"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">No. Matrik / Kad</label>
            <input
              value={matric}
              onChange={(e) => setMatric(e.target.value)}
              placeholder="MD0256789"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">No. WhatsApp *</label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+60182174500"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Emel (pilihan)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Peranan</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StudentRole)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
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
              {pending ? "Mendaftar…" : "Daftar"}
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
              <th className="table-cell">No. KP</th>
              <th className="table-cell">No. Matrik</th>
              <th className="table-cell">WhatsApp</th>
              <th className="table-cell">Peranan</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="table-cell text-center text-slate-500">
                  Tiada pelajar/staf berdaftar lagi. Daftarkan yang pertama.
                </td>
              </tr>
            )}
            {students.map((s) => (
              <StudentRow
                key={s.id}
                student={s}
                onPatch={(body) => callApi(`/api/admin/students/${s.id}`, body, "PATCH")}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentRow({
  student,
  onPatch,
}: {
  student: Student;
  onPatch: (body: any) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(student.whatsapp_phone);
  const [matric, setMatric] = useState(student.matric_number ?? "");
  const [ic, setIc] = useState(student.ic_number ?? "");
  const [role, setRole] = useState<StudentRole>(student.role);

  return (
    <tr className="hover:bg-slate-50">
      <td className="table-cell text-slate-900">{student.full_name}</td>
      <td className="table-cell text-slate-600">
        {editing ? (
          <input
            value={ic}
            onChange={(e) => setIc(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm w-36"
          />
        ) : (
          student.ic_number ?? "—"
        )}
      </td>
      <td className="table-cell text-slate-600">
        {editing ? (
          <input
            value={matric}
            onChange={(e) => setMatric(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm w-32"
          />
        ) : (
          student.matric_number ?? "—"
        )}
      </td>
      <td className="table-cell text-slate-600">
        {editing ? (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm w-36"
          />
        ) : (
          student.whatsapp_phone
        )}
      </td>
      <td className="table-cell text-slate-600 capitalize">
        {editing ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StudentRole)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        ) : (
          student.role
        )}
      </td>
      <td className="table-cell">
        {student.is_active ? (
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
                  const ok = await onPatch({
                    whatsapp_phone: phone,
                    matric_number: matric,
                    ic_number: ic,
                    role,
                  });
                  if (ok) setEditing(false);
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
                onClick={() => onPatch({ is_active: !student.is_active })}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
              >
                {student.is_active ? "Nyahaktif" : "Aktifkan"}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/Card";

type IntakeResponse =
  | {
      kind: "evidence_required";
      replySent: string;
    }
  | {
      kind: "followup";
      replySent: string;
      classification: any;
    }
  | {
      kind: "created";
      complaintId: string;
      complaintCode: string;
      classification: any;
      assignedPic: { id: string; full_name: string; whatsapp_phone: string | null } | null;
      picNotification: string | null;
      complainantAck: string;
    };

const SAMPLES = [
  {
    label: "ICT — Projektor",
    phone: "+60123456001",
    text: "Salam, projektor di Bilik Tutorial 3 tidak menyala langsung sejak pagi tadi.",
    image: true,
  },
  {
    label: "Kebersihan — Tandas",
    phone: "+60123456002",
    text: "Tandas lelaki Aras 2 sangat kotor, ada sampah dan bau tidak menyenangkan.",
    image: true,
  },
  {
    label: "Fasiliti — Lampu",
    phone: "+60123456003",
    text: "Lampu di Dewan Kuliah A rosak, perlu ganti segera.",
    image: true,
  },
  {
    label: "Kabur — perlu follow-up",
    phone: "+60123456004",
    text: "Tolong tengok masalah ni, saya tak boleh kerja dah.",
    image: true,
  },
  {
    label: "Tiada bukti",
    phone: "+60123456005",
    text: "WiFi tak boleh connect di pejabat.",
    image: false,
  },
];

export default function DemoConsole() {
  const [phone, setPhone] = useState(SAMPLES[0].phone);
  const [text, setText] = useState(SAMPLES[0].text);
  const [hasImage, setHasImage] = useState(true);
  const [imageDescription, setImageDescription] = useState(
    "Foto projektor terpasang di siling, skrin kosong"
  );
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<IntakeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadSample(i: number) {
    const s = SAMPLES[i];
    setPhone(s.phone);
    setText(s.text);
    setHasImage(s.image);
    setImageDataUrl(null);
    setOutcome(null);
    setError(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(typeof reader.result === "string" ? reader.result : null);
      setHasImage(true);
    };
    reader.readAsDataURL(f);
  }

  function submit() {
    setError(null);
    setOutcome(null);
    startTransition(async () => {
      const res = await fetch("/api/whatsapp/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          text,
          evidenceDataUrl: hasImage ? imageDataUrl ?? "https://images.unsplash.com/photo-1581090700227-1e8e0a47adb3?w=800" : null,
          imageDescription: hasImage ? imageDescription : undefined,
          provider: "demo",
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }
      setOutcome(j as IntakeResponse);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Simulasi Mesej WhatsApp Masuk"
          subtitle="Hantar mesej seolah-olah dari pengguna kampus."
        />
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button
                key={s.label}
                onClick={() => loadSample(i)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">
              Nombor WhatsApp pengadu
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Mesej</label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasImage}
                onChange={(e) => setHasImage(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Sertakan bukti visual (gambar/tangkap layar)
            </label>
            {hasImage && (
              <div className="space-y-3">
                <input type="file" accept="image/*" onChange={onPickFile} className="text-sm" />
                {imageDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageDataUrl}
                    alt="Pratonton"
                    className="max-h-40 rounded-md border border-slate-200"
                  />
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Deskripsi bukti (untuk konteks AI)
                  </label>
                  <input
                    value={imageDescription}
                    onChange={(e) => setImageDescription(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="cth: Tangkap layar mesej ralat login"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={submit}
            disabled={pending || !phone.trim() || !text.trim()}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Memproses…" : "Hantar Simulasi"}
          </button>

          {error && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Hasil Pemprosesan" subtitle="Paparan langkah demi langkah." />
        <div className="px-5 py-4 space-y-4 text-sm">
          {!outcome && !pending && (
            <p className="text-slate-500">Hantar mesej simulasi untuk melihat hasil di sini.</p>
          )}

          {outcome?.kind === "evidence_required" && (
            <Step
              title="🚫 Bukti diperlukan"
              tone="amber"
              body={
                <>
                  Mesej tidak menyertakan bukti visual. Sistem menghantar balasan automatik:
                  <Bubble dir="out">{outcome.replySent}</Bubble>
                </>
              }
            />
          )}

          {outcome?.kind === "followup" && (
            <>
              <Step
                title="🤖 AI: Maklumat tidak mencukupi"
                tone="blue"
                body={
                  <>
                    <ClassificationBox c={outcome.classification} />
                    Sistem menghantar soalan susulan:
                    <Bubble dir="out">{outcome.replySent}</Bubble>
                  </>
                }
              />
            </>
          )}

          {outcome?.kind === "created" && (
            <>
              <Step
                title={`✅ Tiket dicipta — ${outcome.complaintCode}`}
                tone="emerald"
                body={
                  <>
                    <ClassificationBox c={outcome.classification} />
                    <div className="text-xs text-slate-600">
                      PIC bertugas:{" "}
                      <span className="font-medium text-slate-900">
                        {outcome.assignedPic?.full_name ?? "Tiada PIC ditetapkan"}
                      </span>{" "}
                      {outcome.assignedPic?.whatsapp_phone && (
                        <>· {outcome.assignedPic.whatsapp_phone}</>
                      )}
                    </div>
                    <div className="pt-1">
                      <Link
                        href={`/admin/complaints/${outcome.complaintId}`}
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Buka tiket →
                      </Link>
                    </div>
                  </>
                }
              />
              <Step
                title="📩 Pengakuan kepada pengadu"
                tone="slate"
                body={<Bubble dir="out">{outcome.complainantAck}</Bubble>}
              />
              {outcome.picNotification && (
                <Step
                  title="🛎️ Notifikasi WhatsApp ke PIC"
                  tone="brand"
                  body={<Bubble dir="out">{outcome.picNotification}</Bubble>}
                />
              )}
              <Step
                title="↩️ PIC boleh balas dengan:"
                tone="slate"
                body={
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5">TERIMA</code>{" "}
                    →{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5">DALAM TINDAKAN</code>{" "}
                    →{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5">SELESAI</code>
                    <p className="mt-2">
                      Apabila PIC menghantar <code>SELESAI</code>, sistem auto-mesej pengadu:{" "}
                      <em>“Aduan anda telah diselesaikan. Terima kasih kerana menggunakan Matrivox.”</em>
                    </p>
                  </div>
                }
              />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function Step({
  title,
  body,
  tone,
}: {
  title: string;
  body: React.ReactNode;
  tone: "amber" | "blue" | "emerald" | "brand" | "slate";
}) {
  const toneMap: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50/60",
    blue: "border-blue-200 bg-blue-50/60",
    emerald: "border-emerald-200 bg-emerald-50/60",
    brand: "border-brand-200 bg-brand-50/60",
    slate: "border-slate-200 bg-slate-50/60",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneMap[tone]}`}>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 space-y-2">{body}</div>
    </div>
  );
}

function Bubble({ dir, children }: { dir: "in" | "out"; children: React.ReactNode }) {
  return (
    <div
      className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ring-1 ${
        dir === "out"
          ? "bg-emerald-50 ring-emerald-200 text-slate-800 ml-auto max-w-prose"
          : "bg-white ring-slate-200 text-slate-800 max-w-prose"
      }`}
    >
      {children}
    </div>
  );
}

function ClassificationBox({ c }: { c: any }) {
  if (!c) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
      <Row k="Kategori" v={c.category ?? "—"} />
      <Row k="Lokasi" v={c.location ?? "—"} />
      <Row k="Keyakinan" v={`${Math.round((c.confidence ?? 0) * 100)}%`} />
      <Row k="Sumber" v={c.source} />
      <div className="col-span-2">
        <Row k="Ringkasan" v={c.summary} />
      </div>
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-slate-900">{v}</dd>
    </>
  );
}

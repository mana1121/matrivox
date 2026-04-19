# Matrivox

> Sistem aduan kampus berasaskan WhatsApp + papan pemuka digital.
> Prototaip MVP untuk pertandingan inovasi.

Matrivox menukar aduan WhatsApp yang bersepah dalam grup chat menjadi tiket
berstruktur, mengklasifikasinya menggunakan **Claude AI**, menghalakannya
kepada **PIC yang betul**, dan menjejak status sehingga selesai — semuanya
boleh dilihat di papan pemuka admin/PIC dan boleh disimulasikan dari
**Demo Console** untuk persembahan langsung.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres + Auth + Storage + RLS)
- **Anthropic Claude** untuk klasifikasi (dengan keyword fallback bila tiada API key)
- **Recharts** untuk graf
- WhatsApp adapter abstrak: `demo` (lalai), `twilio`, `meta` — boleh tukar tanpa ubah kod aplikasi.

---

## Cepat mula

### 1. Pasang dependencies

```bash
npm install
```

### 2. Sediakan Supabase

1. Cipta projek di [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → tampal kandungan `supabase/migrations/0001_init.sql` → **Run**.
   Ini akan mencipta semua jadual, RLS, trigger, dan bucket storage `evidence`.
3. **Authentication → Users → Add user** (dengan **Auto Confirm User**) untuk akaun-akaun ini:

   | Emel | Peranan selepas seed |
   |------|----------------------|
   | `admin@matrivox.demo` | Admin |
   | `pic.kebersihan@matrivox.demo` | PIC Kebersihan |
   | `pic.ict@matrivox.demo` | PIC ICT |
   | `pic.fasiliti@matrivox.demo` | PIC Fasiliti |

   Gunakan apa-apa kata laluan (cth: `Matrivox123!`).
4. **SQL Editor → New query** → tampal kandungan `supabase/seed.sql` → **Run**.
   Ini menukar peranan, menetapkan kategori, dan memetakan PIC kepada kategori.

### 3. Konfig environment

Salin `.env.example` ke `.env.local` dan isi:

```bash
cp .env.example .env.local
```

Wajib:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Pilihan tetapi disyorkan untuk demo terbaik:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

> Jika `ANTHROPIC_API_KEY` tidak diset, sistem **automatik beralih kepada
> klasifikasi keyword** (lihat `lib/ai/classifier.ts`). Demo masih berfungsi
> sepenuhnya.

### 4. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) dan log masuk sebagai
`admin@matrivox.demo`.

---

## Aliran demo (untuk juri)

1. Log masuk sebagai admin → buka **Demo Console** dari sidebar.
2. Pilih salah satu sampel butang (cth: *ICT — Projektor*).
3. Klik **Hantar Simulasi**. Anda akan melihat panel kanan menunjukkan:
   - hasil klasifikasi AI (kategori, lokasi, ringkasan, keyakinan, sumber),
   - tiket yang dicipta (ID, no rujukan),
   - mesej pengakuan kepada pengadu,
   - notifikasi WhatsApp ke PIC bertugas.
4. Klik **Buka tiket →** untuk melihat halaman butiran lengkap.
5. Untuk tunjukkan sisi PIC: log keluar → log masuk sebagai
   `pic.ict@matrivox.demo`. Hanya aduan ICT akan kelihatan.
6. Tunjukkan kemaskini status: dari halaman butiran, klik chip status →
   *Dalam Tindakan* → *Selesai*. Apabila *Selesai*, sistem auto-mesej pengadu.
7. Tunjukkan juga sampel **Tiada bukti** (sistem minta gambar) dan sampel
   **Kabur — perlu follow-up** (sistem hantar soalan susulan).

### Simulasi command PIC dari WhatsApp

Demo Console juga menerima mesej dari nombor PIC. Contoh:

- Phone: `+60100000003` (PIC ICT seperti dalam seed)
- Mesej: `SELESAI`

Sistem akan cari aduan terbuka terkini untuk kategori ICT dan tutup ia.

---

## Integrasi WhatsApp sebenar (kemudian)

Adapter berada di `lib/whatsapp/providers/`. Tukar `WHATSAPP_PROVIDER` dalam
`.env.local` kepada `twilio` atau `meta`, dan isi env yang berkaitan. Webhook
masuk anda perlu memanggil `POST /api/whatsapp/inbound` dengan format JSON:

```json
{ "phone": "+60123456789", "text": "...", "evidenceDataUrl": "<url-or-data-uri>" }
```

Tiada perubahan kod aplikasi diperlukan — `processIncomingComplaint` adalah
sumber kebenaran yang sama untuk demo dan pengeluaran.

---

## Struktur projek

```
app/
  (app)/                 ← halaman dilindungi (memerlukan auth)
    admin/
      dashboard/
      complaints/[id]/
      pic-management/
      settings/
      demo/              ← Demo Console
    pic/
      dashboard/
      complaints/[id]/
  api/
    complaints/[id]/status/   ← kemaskini status dari papan pemuka
    admin/pics/...            ← pengurusan PIC (admin sahaja)
    admin/settings/...        ← tetapan sistem (admin sahaja)
    whatsapp/inbound/         ← webhook + endpoint demo
  login/
components/              ← UI primitif yang boleh diguna semula
lib/
  ai/classifier.ts       ← Claude + fallback keyword
  whatsapp/              ← adapter pattern (demo/twilio/meta)
  intake.ts              ← saluran utama: bukti → AI → tiket → notifikasi
  supabase/              ← server, browser, admin (service-role)
supabase/
  migrations/0001_init.sql
  seed.sql
```

---

## Permissions ringkas

| Tindakan | Admin | PIC |
|---|:--:|:--:|
| Lihat semua aduan | ✓ | — |
| Lihat aduan kategori sendiri | ✓ | ✓ |
| Kemaskini status (papan pemuka) | ✓ (perlu sebab override) | ✓ (kategori sendiri) |
| Kemaskini status (WhatsApp) | — | ✓ |
| Urus akaun PIC | ✓ | — |
| Konfigur kategori → PIC | ✓ | — |
| Padam aduan | ❌ (tidak dibenarkan) | ❌ |
| Edit mesej asal pengadu | ❌ | ❌ |

RLS Postgres menguatkuasakan ini di lapisan pangkalan data — `lib/auth.ts`
menambah lapisan kedua di Next.js.

---

## Apa yang **tidak** dimasukkan (sengaja)

- Tiada notifikasi push, e-mel digest, atau eskalasi automatik.
- Tiada level keutamaan tiket (mengikut spec MVP).
- Tiada audit trail tindakan admin selain log status.
- Tiada multi-bahasa runtime (semua copy adalah Bahasa Malaysia).

Ini adalah keputusan reka bentuk MVP — fokus pada aliran teras yang stabil
untuk persembahan inovasi.

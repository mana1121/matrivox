import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Bulk-import student profiles from an uploaded .xlsx or .csv file.
 *
 * The first row is treated as the header. Column names are matched
 * case-insensitively against a set of common aliases so users can paste
 * directly from Malaysian-style spreadsheets without renaming columns.
 *
 *   Required: Nama (full_name), No. WhatsApp (whatsapp_phone)
 *   Optional: No. KP, No. Matrik, Emel, Peranan
 *
 * Behavior:
 *   - Phone numbers are normalized (0123… / 60… / +60… all → +60…).
 *   - Existing rows (same whatsapp_phone) are UPDATED, not duplicated.
 *   - Rows missing required fields are reported as errors and skipped.
 */

const ROLES = new Set(["pelajar", "staff", "pensyarah"]);

type ColumnAlias = { canonical: string; aliases: string[] };
const COLUMNS: ColumnAlias[] = [
  { canonical: "full_name", aliases: ["nama", "nama penuh", "name", "full name", "full_name"] },
  {
    canonical: "whatsapp_phone",
    aliases: [
      "whatsapp", "no whatsapp", "no. whatsapp", "telefon", "no telefon",
      "no. telefon", "phone", "phone number", "whatsapp_phone", "no",
    ],
  },
  { canonical: "ic_number", aliases: ["ic", "kp", "no kp", "no. kp", "ic number", "ic_number", "mykad"] },
  { canonical: "matric_number", aliases: ["matrik", "no matrik", "no. matrik", "matric", "matric number", "matric_number", "kad matrik"] },
  { canonical: "email", aliases: ["email", "emel", "e-mail"] },
  { canonical: "role", aliases: ["role", "peranan", "jawatan"] },
];

function normalizeHeader(s: string): string {
  return String(s || "").toLowerCase().replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();
}

function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    for (const col of COLUMNS) {
      if (col.aliases.includes(norm) && map[col.canonical] === undefined) {
        map[col.canonical] = i;
        return;
      }
    }
  });
  return map;
}

function normalizePhone(raw: unknown): string {
  const s = String(raw ?? "").trim().replace(/[^\d+]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("60")) return "+" + s;
  if (s.startsWith("0")) return "+60" + s.slice(1);
  return "+" + s;
}

export async function POST(req: Request) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let rows: any[][] = [];
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Sila lampirkan fail." }, { status: 400 });
    }
    const arrayBuf = await (file as File).arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, blankrows: false, defval: "" });
  } catch (err: any) {
    return NextResponse.json({ error: `Gagal baca fail: ${err?.message ?? err}` }, { status: 400 });
  }

  if (rows.length < 2) {
    return NextResponse.json(
      { error: "Fail mesti ada baris header dan sekurang-kurangnya satu baris data." },
      { status: 400 },
    );
  }

  const headers = rows[0].map((c) => String(c));
  const colMap = buildColumnMap(headers);

  if (colMap.full_name === undefined || colMap.whatsapp_phone === undefined) {
    return NextResponse.json(
      {
        error:
          "Kolum 'Nama' dan 'No. WhatsApp' wajib ada dalam baris pertama. " +
          `Header dikesan: ${headers.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const dataRows = rows.slice(1);
  const errors: { row: number; reason: string }[] = [];
  const toInsert: any[] = [];

  dataRows.forEach((r, i) => {
    const rowNum = i + 2; // human-friendly (header is row 1)
    const full_name = String(r[colMap.full_name] ?? "").trim();
    const whatsapp_phone = normalizePhone(r[colMap.whatsapp_phone]);
    if (!full_name || !whatsapp_phone || whatsapp_phone.length < 8) {
      errors.push({ row: rowNum, reason: "Nama atau No. WhatsApp kosong/tidak sah." });
      return;
    }
    const ic_number = colMap.ic_number !== undefined ? String(r[colMap.ic_number] ?? "").trim() : "";
    const matric_number = colMap.matric_number !== undefined ? String(r[colMap.matric_number] ?? "").trim() : "";
    const email = colMap.email !== undefined ? String(r[colMap.email] ?? "").trim().toLowerCase() : "";
    const rawRole = colMap.role !== undefined ? String(r[colMap.role] ?? "").trim().toLowerCase() : "";
    const role = ROLES.has(rawRole) ? rawRole : "pelajar";

    toInsert.push({
      full_name,
      whatsapp_phone,
      ic_number: ic_number || null,
      matric_number: matric_number || null,
      email: email || null,
      role,
      is_active: true,
    });
  });

  if (toInsert.length === 0) {
    return NextResponse.json(
      { error: "Tiada baris yang sah untuk diimport.", errors },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  // Upsert on whatsapp_phone — existing rows get refreshed, new rows inserted.
  const { data: upserted, error: upsertErr } = await admin
    .from("students")
    .upsert(toInsert, { onConflict: "whatsapp_phone" })
    .select("id");

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message, errors }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    imported: upserted?.length ?? toInsert.length,
    skipped: errors.length,
    errors,
  });
}

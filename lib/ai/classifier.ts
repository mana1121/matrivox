import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type Category, type ClassificationResult } from "@/lib/types";

const KEYWORDS: Record<Category, string[]> = {
  ICT: [
    "projector", "projektor", "wifi", "internet", "printer",
    "komputer", "laptop", "skrin", "sistem", "login", "aplikasi",
  ],
  Kebersihan: [
    "kotor", "sampah", "bau", "busuk", "najis", "serangga",
    "tikus", "kebersihan", "tumpah", "tersumbat",
  ],
  Fasiliti: [
    "lampu", "kipas", "paip", "pintu", "kerusi", "meja", "tingkap",
    "rosak", "pecah", "bocor", "patah", "runtuh", "jatuh", "siling",
    "lantai", "dinding", "bumbung", "bahaya", "retak", "longkang",
  ],
};

// Disambiguation — some words appear in multiple categories depending on
// modifier. "tandas" alone suggests Kebersihan (cleanliness context), but
// "tandas bocor" / "tandas rosak" is Fasiliti (broken infrastructure).
// Rules: if the message contains a DAMAGE keyword (pecah/rosak/bocor/…),
// Fasiliti gets a strong bonus that overrides Kebersihan defaults.
const DAMAGE_WORDS = [
  "pecah", "rosak", "bocor", "patah", "runtuh", "retak", "bahaya",
];
const CLEANLINESS_WORDS = [
  "kotor", "bau", "busuk", "sampah", "tersumbat", "najis",
];

const LOCATION_HINTS = [
  /\b(bilik(?:\s+(?:tutorial|kuliah|mesyuarat|guru))?\s*[\w-]+)/i,
  /\b(kelas\s*[\w-]+)/i,
  /\b(makmal\s*[\w-]+)/i,
  /\b(dewan\s+[\w\s]+?)(?=[.,\n]|$)/i,
  /\b(blok\s*[\w-]+)/i,
  /\b(aras\s*\d+)/i,
  /\b(tingkat\s*\d+)/i,
  /\b(tandas\s+(?:lelaki|perempuan|guru)?)/i,
  /\b(kafeteria|kantin|surau|perpustakaan|pejabat)/i,
];

function keywordClassify(message: string): ClassificationResult {
  const text = message.toLowerCase();
  const scores: Record<Category, number> = { Kebersihan: 0, ICT: 0, Fasiliti: 0 };

  for (const cat of CATEGORIES) {
    for (const kw of KEYWORDS[cat]) {
      if (text.includes(kw)) scores[cat] += 1;
    }
  }

  // Disambiguation bonus: damage words strongly imply Fasiliti, even if a
  // Kebersihan keyword also matched (e.g. "longkang pecah" = broken drain).
  // Cleanliness words reinforce Kebersihan in ambiguous cases.
  const hasDamage = DAMAGE_WORDS.some((w) => text.includes(w));
  const hasCleanliness = CLEANLINESS_WORDS.some((w) => text.includes(w));
  if (hasDamage && !hasCleanliness) scores.Fasiliti += 2;
  if (hasCleanliness && !hasDamage) scores.Kebersihan += 1;

  const ranked = (Object.entries(scores) as [Category, number][]).sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = ranked[0];
  const [, secondScore] = ranked[1];

  let location: string | null = null;
  for (const re of LOCATION_HINTS) {
    const m = message.match(re);
    if (m?.[1]) {
      location = m[1].trim().replace(/\s+/g, " ");
      break;
    }
  }

  const hasCategory = topScore > 0 && topScore > secondScore;
  const hasLocation = !!location;
  const confidence = hasCategory ? Math.min(0.55 + topScore * 0.1, 0.85) : 0.3;

  let needs_followup = false;
  let followup_question: string | null = null;
  if (!hasCategory && !hasLocation) {
    needs_followup = true;
    followup_question =
      "Boleh nyatakan jenis aduan (Kebersihan / ICT / Fasiliti) dan lokasi sebenar (cth: Bilik Tutorial 3)?";
  } else if (!hasCategory) {
    needs_followup = true;
    followup_question = "Aduan ini berkaitan apa? Kebersihan, ICT, atau Fasiliti?";
  } else if (!hasLocation) {
    needs_followup = true;
    followup_question = "Boleh nyatakan lokasi sebenar aduan ini? (cth: Bilik Tutorial 3, Aras 2)";
  }

  const summary =
    message.length > 120 ? message.slice(0, 117).trim() + "..." : message.trim();

  return {
    category: hasCategory ? topCat : null,
    location,
    summary,
    confidence,
    needs_followup,
    followup_question,
    source: "keyword",
  };
}

const SYSTEM_PROMPT = `You are the triage engine for "Matrivox", a campus complaint system.
You classify Malay/English complaints into ONE of these categories:

- "Kebersihan"  -> CLEANLINESS issues: dirty toilets, rubbish, bad smell,
                   clogged drains, pests, spills, stains, sanitation.
                   Key intent: "something is DIRTY or needs CLEANING".

- "ICT"         -> TECHNOLOGY issues: projectors, wifi/internet, printers,
                   computers, laptops, screens, login/system issues, apps.
                   Key intent: "something DIGITAL is not working".

- "Fasiliti"    -> PHYSICAL INFRASTRUCTURE issues: broken/damaged items,
                   lights, fans, taps, doors, chairs, tables, windows,
                   walls, ceilings, drains that are BROKEN (not clogged),
                   leaks, cracks, safety hazards.
                   Key intent: "something is BROKEN, DAMAGED, or UNSAFE".

CRITICAL DISAMBIGUATION RULES:
- "longkang pecah / longkang rosak / longkang bocor" -> Fasiliti (damage)
- "longkang tersumbat / longkang kotor / longkang bau" -> Kebersihan (dirt)
- "tandas bocor / tandas rosak / paip tandas pecah" -> Fasiliti (damage)
- "tandas kotor / tandas bau / tandas bersepah" -> Kebersihan (dirt)
- Whenever the user mentions "pecah, rosak, bocor, patah, retak, bahaya,
  runtuh" treat it as Fasiliti UNLESS the main problem is clearly dirt.
- Whenever the user mentions "kotor, bau, busuk, sampah, tersumbat" treat
  it as Kebersihan UNLESS the main problem is clearly physical damage.

Return STRICT JSON. No prose, no markdown fences. Schema:
{
  "category": "Kebersihan" | "ICT" | "Fasiliti" | null,
  "location": string | null,
  "summary": string,           // <= 120 chars, neutral, in Malay if input is Malay
  "confidence": number,        // 0..1
  "needs_followup": boolean,
  "followup_question": string | null
}

Rules:
- Category is REQUIRED when the message describes a real problem. Only set
  category=null if the message is purely a greeting or has no complaint
  content at all.
- Do NOT invent a location. If the user did not mention one, set location=null.
- Set needs_followup=false if you have any reasonable classification,
  even without location (the system handles missing location gracefully).
- Never output anything outside the JSON.`;

async function claudeClassify(
  message: string,
  imageDescription?: string
): Promise<ClassificationResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const userText =
      `Complaint message:\n"""${message}"""` +
      (imageDescription ? `\n\nAttached image context: ${imageDescription}` : "");

    const resp = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Strip stray fences if Claude misbehaves
    const json = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(json);

    const category =
      parsed.category && CATEGORIES.includes(parsed.category) ? (parsed.category as Category) : null;

    const result: ClassificationResult = {
      category,
      location: parsed.location ?? null,
      summary: String(parsed.summary ?? message.slice(0, 120)),
      confidence: Number(parsed.confidence ?? 0.5),
      needs_followup: Boolean(parsed.needs_followup),
      followup_question: parsed.followup_question ?? null,
      source: "claude",
    };

    // Simple flow: we no longer force follow-up based on confidence.
    // Intake will create a ticket with the best guess + default category.
    return result;
  } catch (err) {
    console.error("[classifier] Claude failed, falling back to keywords:", err);
    return null;
  }
}

export async function classifyComplaint(
  message: string,
  imageDescription?: string
): Promise<ClassificationResult> {
  const fromClaude = await claudeClassify(message, imageDescription);
  if (fromClaude) return fromClaude;
  return keywordClassify(message);
}

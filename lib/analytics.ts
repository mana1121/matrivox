import { CATEGORIES, STATUSES, type Category, type Status } from "@/lib/types";

type DatedRow = { created_at: string; category: Category | null; status: Status };

export function categoryCounts(rows: DatedRow[]) {
  const out = CATEGORIES.map((c) => ({
    category: c as string,
    count: rows.filter((r) => r.category === c).length,
  }));
  return out;
}

export function statusCounts(rows: DatedRow[]) {
  const out = STATUSES.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }));
  return out;
}

/** Last N days: array of {label: 'Mon', count: x} */
export function dailyTrend(rows: DatedRow[], days = 7) {
  const now = new Date();
  const points: { label: string; count: number; iso: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    points.push({
      label: d.toLocaleDateString("en-MY", { weekday: "short" }),
      count: 0,
      iso,
    });
  }
  for (const r of rows) {
    const k = new Date(r.created_at).toISOString().slice(0, 10);
    const p = points.find((p) => p.iso === k);
    if (p) p.count += 1;
  }
  return points.map(({ label, count }) => ({ label, count }));
}

/** Last N weeks of weekly totals. */
export function weeklyTrend(rows: DatedRow[], weeks = 8) {
  const now = new Date();
  const points: { label: string; count: number; start: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() - i * 7); // Sunday-start week
    const start = d.getTime();
    points.push({
      label: d.toLocaleDateString("en-MY", { day: "2-digit", month: "short" }),
      count: 0,
      start,
    });
  }
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    for (let i = points.length - 1; i >= 0; i--) {
      if (t >= points[i].start) {
        points[i].count += 1;
        break;
      }
    }
  }
  return points.map(({ label, count }) => ({ label, count }));
}

import { type ClassValue, clsx } from "clsx";
import type { Status } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function statusBadgeClass(status: Status): string {
  switch (status) {
    case "Diterima":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "Dalam Tindakan":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "Selesai":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
}

export function categoryBadgeClass(category: string | null): string {
  switch (category) {
    case "Kebersihan":
      return "bg-teal-50 text-teal-700 ring-1 ring-teal-200";
    case "ICT":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
    case "Fasiliti":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

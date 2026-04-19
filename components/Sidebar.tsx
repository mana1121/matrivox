"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

type Item = { href: string; label: string; icon: React.ReactNode };

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.5 14.5c2.7.5 4.5 2.6 4.5 5.5" strokeLinecap="round" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
function IconConsole() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const adminItems: Item[] = [
    { href: "/admin/dashboard", label: "Papan Pemuka", icon: <IconHome /> },
    { href: "/admin/complaints", label: "Aduan", icon: <IconList /> },
    { href: "/admin/pic-management", label: "Pengurusan PIC", icon: <IconUsers /> },
    { href: "/admin/settings", label: "Tetapan", icon: <IconSettings /> },
    { href: "/admin/demo", label: "Demo Console", icon: <IconConsole /> },
  ];

  const picItems: Item[] = [
    { href: "/pic/dashboard", label: "Papan Pemuka", icon: <IconHome /> },
    { href: "/pic/complaints", label: "Aduan Saya", icon: <IconList /> },
  ];

  const items = role === "admin" ? adminItems : picItems;

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white grid place-items-center font-semibold">
          M
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Matrivox</div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            {role === "admin" ? "Admin" : "PIC"}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3">
        <ul className="space-y-1">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    active
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <span className={cn(active ? "text-brand-600" : "text-slate-500")}>
                    {it.icon}
                  </span>
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-5 py-4 border-t border-slate-200 text-xs text-slate-500">
        Prototaip Inovasi
      </div>
    </aside>
  );
}

import SignOutButton from "./SignOutButton";
import type { AppUser } from "@/lib/types";

export default function TopBar({ user, title }: { user: AppUser; title: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-6 py-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-xs text-slate-500">
          {user.role === "admin"
            ? "Akses penuh ke semua aduan"
            : `Kategori: ${user.category_assigned ?? "—"}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-slate-800">{user.full_name || user.email}</span>
          <span className="text-xs text-slate-500 capitalize">{user.role}</span>
        </div>
        <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold">
          {(user.full_name || user.email).slice(0, 1).toUpperCase()}
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}

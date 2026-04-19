import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "brand" | "amber" | "blue" | "emerald" | "rose" | "slate";
}) {
  const accentMap: Record<string, string> = {
    brand: "from-brand-50 to-white text-brand-700",
    amber: "from-amber-50 to-white text-amber-700",
    blue: "from-blue-50 to-white text-blue-700",
    emerald: "from-emerald-50 to-white text-emerald-700",
    rose: "from-rose-50 to-white text-rose-700",
    slate: "from-slate-50 to-white text-slate-700",
  };
  return (
    <Card className={cn("p-5 bg-gradient-to-b", accentMap[accent])}>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}

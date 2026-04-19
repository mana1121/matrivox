import { categoryBadgeClass, statusBadgeClass } from "@/lib/utils";
import type { Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}
    >
      {status}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string | null }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryBadgeClass(category)}`}
    >
      {category ?? "—"}
    </span>
  );
}

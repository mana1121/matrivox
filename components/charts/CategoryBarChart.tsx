"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type CategoryDatum = { category: string; count: number };

const COLORS: Record<string, string> = {
  Kebersihan: "#0d9488",
  ICT: "#4f46e5",
  Fasiliti: "#e11d48",
};

export default function CategoryBarChart({ data }: { data: CategoryDatum[] }) {
  return (
    <div className="h-64 w-full px-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(148,163,184,0.12)" }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.category} fill={COLORS[d.category] || "#3766ff"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

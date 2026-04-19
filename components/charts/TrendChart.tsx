"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export type TrendPoint = { label: string; count: number };

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full px-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              fontSize: 12,
            }}
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#2147e8"
            strokeWidth={2.4}
            dot={{ r: 3, stroke: "#2147e8", fill: "#fff" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

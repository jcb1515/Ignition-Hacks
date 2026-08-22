"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/types";

/** Cash remaining per month under each scenario. Zero means out of money. */
export default function RunwayChart({
  data,
}: {
  data: { month: string; [scenario: string]: number | string }[];
}) {
  const series = [
    { key: "Current", color: "#d2562d" },
    { key: "Aggressive cut", color: "#2d9bd2" },
    { key: "Hiring freeze", color: "#8d2dd2" },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(244, 247, 251, 0.09)" />
          <XAxis dataKey="month" stroke="var(--color-slate)" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
          <YAxis
            tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
            stroke="var(--color-slate)"
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "#3d7bff", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "#0d1017",
              border: "1px solid #232b38",
              borderRadius: "0px",
              color: "#f4f7fb",
            }}
            formatter={(v, name) => [formatCurrency(Number(v ?? 0)), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-muted)" }} />
          {series.map((s) => (
            <Line
              key={s.key} type="monotone" dataKey={s.key} name={s.key}
              stroke={s.color} strokeWidth={2} dot={false}
              animationDuration={1600}
              activeDot={{ r: 5, fill: s.color, stroke: "#0d1017", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

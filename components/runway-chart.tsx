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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(248,247,241,0.08)" />
          <XAxis dataKey="month" stroke="#9a9d94" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#9a9d94" fontSize={11} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "#1b1d1b", border: "1px solid #32352f",
              borderRadius: 8, fontSize: 12, color: "#f8f7f1",
            }}
            formatter={(v, name) => [formatCurrency(Number(v ?? 0)), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9a9d94" }} />
          {series.map((s) => (
            <Line
              key={s.key} type="monotone" dataKey={s.key} name={s.key}
              stroke={s.color} strokeWidth={2} dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

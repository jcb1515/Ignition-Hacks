"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/data";

export default function RunwayChart({
  data,
}: {
  data: {
    month: string;
    current: number;
    aggressiveCut: number;
    hiringFreeze: number;
  }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255, 255, 255, 0.1)"
          />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => `$${v / 1000}k`}
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #2a2a32",
              borderRadius: "8px",
              color: "#ffffff",
            }}
            formatter={(value: number | string | ReadonlyArray<number | string> | undefined, name: number | string | undefined) => [
              value === undefined ? "—" : formatCurrency(Number(Array.isArray(value) ? value[0] : value)),
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }} />
          <Line
            type="monotone"
            dataKey="current"
            name="Current"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="aggressiveCut"
            name="Aggressive cut"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="hiringFreeze"
            name="Hiring freeze"
            stroke="#f472b6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

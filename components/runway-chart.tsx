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
            stroke="rgba(244, 247, 251, 0.09)"
          />
          <XAxis
            dataKey="month"
            stroke="#626e85"
            tick={{ fill: "#94a0b8", fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v) => `$${v / 1000}k`}
            stroke="#626e85"
            tick={{ fill: "#94a0b8", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "#3d7bff", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              color: "#0f172a",
            }}
            formatter={(value: number | string | ReadonlyArray<number | string> | undefined, name: number | string | undefined) => [
              value === undefined ? "—" : formatCurrency(Number(Array.isArray(value) ? value[0] : value)),
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: "11px", color: "#94a0b8" }} />
          <Line
            type="monotone"
            dataKey="current"
            name="Current"
            stroke="#3d7bff"
            strokeWidth={2}
            dot={false}
            animationDuration={700}
            activeDot={{ r: 5, fill: "#3d7bff", stroke: "#0f172a", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="aggressiveCut"
            name="Aggressive cut"
            stroke="#7ee3ff"
            strokeWidth={2}
            dot={false}
            animationDuration={900}
            activeDot={{ r: 5, fill: "#7ee3ff", stroke: "#0f172a", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="hiringFreeze"
            name="Hiring freeze"
            stroke="#8f7dff"
            strokeWidth={2}
            dot={false}
            animationDuration={1100}
            activeDot={{ r: 5, fill: "#8f7dff", stroke: "#0f172a", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/data";

export default function BurnChart({
  data,
}: {
  data: { month: string; burn: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorBurn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="burn"
            name="Burn"
            stroke="#34d399"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorBurn)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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
              <stop offset="5%" stopColor="#3d7bff" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3d7bff" stopOpacity={0} />
            </linearGradient>
          </defs>
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
              backgroundColor: "#0d1017",
              border: "1px solid #232b38",
              borderRadius: "0px",
              color: "#f4f7fb",
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
            stroke="#3d7bff"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorBurn)"
            animationDuration={1600}
            activeDot={{ r: 5, fill: "#7ee3ff", stroke: "#0d1017", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

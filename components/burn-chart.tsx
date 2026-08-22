"use client";

import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/types";

/**
 * Total burn and the vendor slice of it. Both lines matter: payroll dominates
 * the total, so a single "burn" line hides the only number this product moves.
 */
export default function BurnChart({
  data,
}: {
  data: { month: string; burn: number; vendorSpend: number }[];
}) {
  return (
    <div className="h-56 w-full min-w-0 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBurn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d9bd2" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2d9bd2" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorVendor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d2562d" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#d2562d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(244, 247, 251, 0.09)" />
          <XAxis dataKey="month" stroke="var(--color-slate)" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
          <YAxis
            width={42}
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
          <Area
            type="monotone" dataKey="burn" name="Total burn"
            stroke="#2d9bd2" strokeWidth={2} fillOpacity={1} fill="url(#colorBurn)"
            animationDuration={1600}
            activeDot={{ r: 5, fill: "#7ee3ff", stroke: "#0d1017", strokeWidth: 2 }}
          />
          <Area
            type="monotone" dataKey="vendorSpend" name="Vendor spend"
            stroke="#d2562d" strokeWidth={2} fillOpacity={1} fill="url(#colorVendor)"
            animationDuration={1600}
            activeDot={{ r: 5, fill: "#f2994a", stroke: "#0d1017", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

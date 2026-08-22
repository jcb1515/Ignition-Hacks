"use client";

import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/types";

/**
 * Total burn and the vendor slice of it. Both lines matter: payroll dominates
 * the total, so a single "burn" line hides the only number this product can
 * actually move.
 */
export default function BurnChart({
  data,
}: {
  data: { month: string; burn: number; vendorSpend: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gBurn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d9bd2" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2d9bd2" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gVendor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d2562d" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#d2562d" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone" dataKey="burn" name="Total burn"
            stroke="#2d9bd2" strokeWidth={2} fill="url(#gBurn)"
          />
          <Area
            type="monotone" dataKey="vendorSpend" name="Vendor spend"
            stroke="#d2562d" strokeWidth={2} fill="url(#gVendor)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

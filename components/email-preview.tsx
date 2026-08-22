"use client";

import { useState } from "react";
import { Send, Trash2, Copy } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import type { Vendor } from "@/lib/data";

export default function EmailPreview({ vendor }: { vendor: Vendor }) {
  const [approved, setApproved] = useState(false);

  const email = `Hi ${vendor.name} team,

We’ve been reviewing our tooling budget for 2026 and noticed our monthly bill of ${formatCurrency(
    vendor.monthlyCost
  )} for ${vendor.category.toLowerCase()} services is significantly above the category benchmark.

We’d like to explore a tier downgrade or a discounted annual commitment. If we can’t align on a more competitive rate, we’ll need to migrate to an alternative before our next billing cycle.

Can we schedule 15 minutes this week?

Thanks,
The Runway Radar team`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">
          To:{" "}
          <span className="font-medium text-on-card">{vendor.contactEmail}</span>
        </p>
        <div className="flex gap-2">
          <button className="rounded-md border border-border-card p-1.5 text-muted hover:bg-card-2">
            <Copy size={14} />
          </button>
          <button className="rounded-md border border-border-card p-1.5 text-muted hover:bg-card-2">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-border-card bg-card-2 p-4 text-sm leading-relaxed text-on-card">
        {email.split("\n").map((line, i) => (
          <p key={i} className={line === "" ? "h-4" : "mb-1"}>
            {line}
          </p>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <input
            id="approve"
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
            className="h-4 w-4 rounded border-border-card bg-card-2 text-mint focus:ring-mint"
          />
          <label
            htmlFor="approve"
            className="text-sm font-medium text-muted"
          >
            Human approve before send
          </label>
        </div>
        <button
          disabled={!approved}
          className="inline-flex items-center gap-2 rounded-full bg-on-card px-6 py-3 text-sm font-medium text-card hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={14} />
          Send to {vendor.name}
        </button>
      </div>
    </div>
  );
}

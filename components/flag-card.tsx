"use client";

import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { FeatureBreakdown } from "@/lib/types";

export interface FlagView {
  vendorId: string;
  vendorName: string;
  kind: string;
  confidence: number;
  headline: string;
  monthlyCost: number;
  features: FeatureBreakdown[];
  savings?: number;
}

const KIND_LABEL: Record<string, string> = {
  overpriced: "Above category norm",
  duplicate: "Duplicate tooling",
  usage_drift: "Unused capacity",
  price_creep: "Price creep",
};

/**
 * A flag plus the exact decomposition of its score.
 *
 * Contributions are signed, so this is a diverging encoding: one hue for
 * signals pushing toward a flag, another for signals pushing away, neutral at
 * zero. Bars are scaled against the largest absolute contribution in the card
 * so the dominant reason is obvious at a glance. Every bar is labeled with its
 * value, so the reading never depends on color alone.
 */
export default function FlagCard({ flag }: { flag: FlagView }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(...flag.features.map((f) => Math.abs(f.contribution)), 0.01);

  return (
    <div className="border border-border-card bg-card-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-card-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TriangleAlert size={14} className="shrink-0 text-[var(--color-series-1)]" />
            <span className="font-medium text-on-card">{flag.vendorName}</span>
            <span className="border border-border-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {KIND_LABEL[flag.kind] ?? flag.kind}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{flag.headline}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-on-card">{formatCurrency(flag.monthlyCost)}/mo</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            {(flag.confidence * 100).toFixed(0)}% confidence
          </p>
          {typeof flag.savings === "number" && flag.savings > 0 && (
            <p className="mt-1 font-mono text-xs text-[var(--color-series-2)]">
              save {formatCurrency(flag.savings)}/mo
            </p>
          )}
          <ChevronDown
            size={15}
            className={`ml-auto mt-2 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border-card px-4 pb-4 pt-3">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-slate">
            Why this fired — exact contribution to the score
          </p>

          <div className="space-y-3">
            {flag.features.map((f) => {
              const pct = (Math.abs(f.contribution) / max) * 100;
              const pushes = f.contribution >= 0;
              return (
                <div key={f.feature}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-on-card">
                      {f.feature.replaceAll("_", " ")}
                    </span>
                    <span
                      className="shrink-0 font-mono text-xs"
                      style={{ color: pushes ? "var(--color-push)" : "var(--color-pull)" }}
                    >
                      {pushes ? "+" : ""}{f.contribution.toFixed(2)}
                    </span>
                  </div>
                  {/* Diverging bar: center line is zero, right pushes toward a flag. */}
                  <div className="relative h-2 w-full bg-card-3">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-zero)]" />
                    <div
                      className="absolute inset-y-0 rounded-[2px]"
                      style={{
                        width: `${pct / 2}%`,
                        [pushes ? "left" : "right"]: "50%",
                        background: pushes ? "var(--color-push)" : "var(--color-pull)",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate">{f.value}</p>
                </div>
              );
            })}
          </div>

          <p className="mt-4 border-t border-border-card pt-3 text-[11px] leading-relaxed text-slate">
            The score is a linear model, so each contribution above is that feature&apos;s
            exact Shapley value — not an approximation. Positive values push toward
            flagging; negative values argue against it.
          </p>
        </div>
      )}
    </div>
  );
}

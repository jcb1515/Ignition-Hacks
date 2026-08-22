"use client";

import { Bot, CircleCheck, Loader2, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { AgentAction } from "@/lib/types";

const AGENT_COLOR: Record<string, string> = {
  Classifier: "var(--color-series-1)",
  Forecast: "var(--color-series-2)",
  Negotiator: "var(--color-series-3)",
  Orchestrator: "var(--color-muted)",
};

/**
 * The action log. Reasoning is the point — an agent demo that shows only
 * outcomes is indistinguishable from a script, so every row carries the
 * sentence that explains why the step happened.
 */
export default function AgentStream({
  actions, running, status,
}: {
  actions: AgentAction[];
  running: boolean;
  status: string;
}) {
  return (
    <div className="flex h-full flex-col">
      {running && (
        <div className="mb-3 flex items-center gap-2 border border-border-card bg-card-2 px-3 py-2">
          <Loader2 size={13} className="animate-spin text-on-card" />
          <span className="font-mono text-[11px] text-muted">{status || "Working..."}</span>
        </div>
      )}

      {actions.length === 0 && !running && (
        <div className="flex flex-1 items-center justify-center border border-dashed border-border-card p-8 text-center">
          <p className="max-w-xs text-sm leading-relaxed text-slate">
            No audit has run yet. Start one to see each agent&apos;s reasoning as it works.
          </p>
        </div>
      )}

      <div className="divide-y divide-border-card overflow-y-auto">
        {actions.map((a) => (
          <div key={a.id} className="py-4 first:pt-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em]">
                <Bot size={11} style={{ color: AGENT_COLOR[a.agent] }} />
                <span style={{ color: AGENT_COLOR[a.agent] }}>{a.agent}</span>
                <span className="text-slate">/ {a.type.replaceAll("_", " ")}</span>
              </span>
              <span className="font-mono text-[10px] text-slate">{a.timestamp}</span>
            </div>

            {a.target && (
              <p className="mb-1 text-sm font-medium text-on-card">{a.target}</p>
            )}
            <p className="text-sm leading-relaxed text-muted">{a.reasoning}</p>

            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-xs text-slate">
                {a.dollarImpact !== 0 ? formatCurrency(Math.abs(a.dollarImpact)) + "/mo" : "—"}
              </span>
              {a.approvalRequired && !a.humanApproved ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-series-1)]">
                  <ShieldAlert size={11} /> Awaiting human
                </span>
              ) : a.humanApproved ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-series-2)]">
                  <CircleCheck size={11} /> Cleared
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

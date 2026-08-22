"use client";

import { useEffect, useState } from "react";
import { Check, Handshake, Loader2, ShieldAlert, UserRound, Bot, X } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { AgentAction } from "@/lib/types";

interface Summary {
  outcome: "accepted" | "pending_approval" | "escalated" | "no_flag";
  rounds: number; startMonthly: number; bestOfferMonthly: number; realisedMonthlySavings: number;
}

const OUTCOME_LABEL: Record<Summary["outcome"], string> = {
  accepted: "Closed by the agent",
  pending_approval: "Deal reached — needs your sign-off",
  escalated: "Escalated — vendor's best offer is below target",
  no_flag: "Nothing to negotiate",
};

/**
 * One vendor's negotiation as a thread. Agent turns on the left, vendor turns
 * on the right, decisions in between. Drives POST /api/negotiate as SSE so the
 * exchange appears turn by turn.
 */
export default function NegotiationThread({
  vendorId, vendorName, onDone,
}: { vendorId: string; vendorName: string; onDone?: () => void }) {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  // Subscribe to the existing thread for this vendor; state is set in the fetch callback.
  useEffect(() => {
    let alive = true;
    fetch(`/api/negotiate?vendorId=${encodeURIComponent(vendorId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setActions(d.actions ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [vendorId]);

  const negotiate = async () => {
    setRunning(true); setSummary(null); setActions([]); setStatus("Opening talks...");
    try {
      const res = await fetch("/api/negotiate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendorId }),
      });
      const reader = res.body?.getReader(); if (!reader) return;
      const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.startsWith("data:")) continue;
          const e = JSON.parse(p.slice(5));
          if (e.type === "status") setStatus(e.message);
          else if (e.type === "action") setActions((a) => [...a, e.action]);
          else if (e.type === "done") setSummary(e.summary);
        }
      }
    } finally {
      setRunning(false); setStatus("");
      onDone?.();
    }
  };

  const hasThread = actions.length > 0;

  const decide = async (actionId: string, decision: "accept" | "walk") => {
    const res = await fetch("/api/negotiate/decide", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId, decision }),
    });
    if (res.ok) {
      const t = await fetch(`/api/negotiate?vendorId=${encodeURIComponent(vendorId)}`, { cache: "no-store" });
      if (t.ok) setActions((await t.json()).actions ?? []);
      onDone?.();
    }
  };

  return (
    <div className="border border-border-card bg-card-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted">Negotiation · {vendorName}</p>
        <button type="button" onClick={negotiate} disabled={running}
          className="inline-flex items-center gap-1.5 border border-border-card px-3 py-1.5 font-sans text-[10px] uppercase tracking-[0.12em] text-on-card transition-colors hover:bg-card-3 disabled:opacity-50">
          {running ? <Loader2 size={12} className="animate-spin" /> : <Handshake size={12} />}
          {running ? "Negotiating" : hasThread ? "Re-run" : "Negotiate"}
        </button>
      </div>

      {running && status && <p className="mb-3 font-sans text-[11px] text-muted">{status}</p>}

      {!hasThread && !running && (
        <p className="text-xs text-muted">The audit sent one ask. Press Negotiate and the agent will run the rest of the conversation — counter, evaluate, accept or escalate — against the vendor.</p>
      )}

      <ol className="space-y-2">
        {actions.map((a) => {
          const vendorTurn = a.type.startsWith("vendor_");
          const decision = /accept|escalat|evaluate|opened/.test(a.type);
          return (
            <li key={a.id} className={`flex ${vendorTurn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] border px-3 py-2 text-xs leading-relaxed ${
                vendorTurn ? "border-border-card bg-card text-muted"
                : decision ? "border-[var(--color-series-3)] bg-card-3 text-on-card"
                : "border-border-card bg-card-3 text-on-card"}`}>
                <p className="mb-1 flex items-center gap-1 font-sans text-[9px] uppercase tracking-[0.1em] text-muted">
                  {vendorTurn ? <UserRound size={10} /> : <Bot size={10} />}
                  {vendorTurn ? vendorName : "Negotiator"} · {a.type.replace(/^(vendor_|negotiation_)/, "").replaceAll("_", " ")}
                  {a.approvalRequired && !a.humanApproved && <ShieldAlert size={10} style={{ color: "var(--color-series-1)" }} />}
                </p>
                {a.reasoning.replace(/^\[[^\]]+\]\s*/, "")}
                {a.approvalRequired && !a.humanApproved && /^negotiation_(accept_pending|escalated)$/.test(a.type) && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void decide(a.id, "accept")}
                      className="inline-flex items-center gap-1 border border-border-card px-2 py-1 font-sans text-[10px] uppercase tracking-[0.1em] text-on-card hover:bg-card">
                      <Check size={11} /> Accept {formatCurrency(a.dollarImpact)}/mo
                    </button>
                    <button type="button" onClick={() => void decide(a.id, "walk")}
                      className="inline-flex items-center gap-1 border border-border-card px-2 py-1 font-sans text-[10px] uppercase tracking-[0.1em] text-muted hover:bg-card">
                      <X size={11} /> Walk
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {summary && (
        <div className="mt-3 border-t border-hairline pt-3 text-xs">
          <p className="font-medium text-on-card">{OUTCOME_LABEL[summary.outcome]}</p>
          <p className="mt-1 text-muted">
            {summary.rounds} round{summary.rounds === 1 ? "" : "s"} · {formatCurrency(summary.startMonthly)} → {formatCurrency(summary.bestOfferMonthly)}/mo
            {summary.realisedMonthlySavings > 0 && <> · <span className="text-[var(--color-series-2)]">{formatCurrency(summary.realisedMonthlySavings)}/mo realised</span></>}
          </p>
        </div>
      )}
    </div>
  );
}

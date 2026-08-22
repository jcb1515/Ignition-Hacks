"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Play, RotateCcw } from "lucide-react";
import AgentStream from "@/components/agent-stream";
import DataSourceBadge from "@/components/data-source-badge";
import ApprovalQueue, { type QueueItem } from "@/components/approval-queue";
import AskAgent from "@/components/ask-agent";
import BurnChart from "@/components/burn-chart";
import FlagCard, { type FlagView } from "@/components/flag-card";
import RunwayChart from "@/components/runway-chart";
import StatTile from "@/components/stat-tile";
import UploadPanel from "@/components/upload-panel";
import VendorTable from "@/components/vendor-table";
import { Tabs } from "@/components/tabs";
import { formatCurrency } from "@/lib/types";
import type { AgentAction, Transaction, Vendor } from "@/lib/types";

interface Scenario {
  label: string; description: string; monthlyBurn: number;
  netBurn: number; runwayMonths: number; path: number[];
}
interface State {
  company: { name: string; headcount: number; cashOnHand: number; mrr: number };
  revenue: {
    mrr: number; source: "stripe" | "seed"; activeSubscriptions: number; syncedAt?: string;
    subscriptions: Array<{ id: string; productName: string; status: string; monthlyAmount: number }>;
  };
  config: { demoMode: boolean; llmLive: boolean; approvalThreshold: number };
  vendors: Vendor[];
  transactions: Transaction[];
  flags: FlagView[];
  actions: AgentAction[];
  drafts: Array<{
    id: string; vendorId: string; subject: string; body: string;
    toEmail: string; createdAt: string; approved: boolean; sent: boolean;
  }>;
  forecast: {
    vendorSpend: number;
    scenarios: Scenario[];
    monteCarlo: Record<string, { p10: number; p50: number; p90: number; trials: number }>;
    history: Array<{ month: string; burn: number; vendorSpend: number }>;
    totalMonthlySavings: number;
  };
  audited: boolean;
}

export default function Dashboard() {
  const [state, setState] = useState<State | null>(null);
  const [live, setLive] = useState<AgentAction[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  /** Manual refresh, used after an audit or an approval decision. */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed to load");
      setState(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API");
    }
  }, []);

  // Initial load. State is set from the fetch callback rather than the effect
  // body, and the guard stops a slow response writing to an unmounted page.
  //
  // When DEMO_MODE=false and sandbox keys are configured, also pull Plaid and
  // Stripe once so the numbers on screen are the live ones. On a serverless
  // host the database is per-instance, so this is what keeps a fresh instance
  // from showing the seeded MRR next to a "Live sandbox" badge.
  useEffect(() => {
    let cancelled = false;
    const fetchState = async () => {
      const res = await fetch("/api/state", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "failed to load");
      return body as State;
    };
    (async () => {
      try {
        const first = await fetchState();
        if (cancelled) return;
        setState(first);
        setError(null);

        const src = await fetch("/api/sync", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (cancelled || !src || src.mode !== "live" || !(src.plaid || src.stripe)) return;

        setStatus("Syncing live sandbox data...");
        const sync = await fetch("/api/sync", { method: "POST" }).then((r) => r.json()).catch(() => null);
        if (cancelled) return;
        const problems = [sync?.plaid?.error, sync?.stripe?.error, sync?.error].filter(Boolean);
        if (problems.length) setError(`Sync: ${problems.join(" · ")}`);

        const after = await fetchState();
        if (!cancelled) setState(after);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not reach the API");
      } finally {
        if (!cancelled) setStatus("");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Reads the SSE stream so reasoning appears as it is produced. */
  const runAudit = async () => {
    setRunning(true);
    setLive([]);
    setStatus("Starting audit...");
    setError(null);

    try {
      const res = await fetch("/api/audit", { method: "POST" });
      if (!res.body) throw new Error("no response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "status") setStatus(event.message);
          else if (event.type === "action") setLive((prev) => [...prev, event.action]);
          else if (event.type === "error") setError(event.message);
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setRunning(false);
      setStatus("");
    }
  };

  const reseed = async () => {
    setRunning(true);
    setStatus("Reseeding...");
    await fetch("/api/reset", { method: "POST" });
    setLive([]);
    await load();
    setRunning(false);
    setStatus("");
  };

  const decide = async (draftId: string, decision: "approve" | "reject") => {
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, decision }),
    });
    await load();
  };

  useEffect(() => {
    streamRef.current?.scrollTo({ top: 0 });
  }, [live.length]);

  /** Recharts wants one row per month with a key per scenario. */
  const runwaySeries = useMemo(() => {
    if (!state) return [];
    const [current, cut, freeze] = state.forecast.scenarios;
    return current.path.map((_, i) => ({
      month: `M${i + 1}`,
      Current: current.path[i],
      "Aggressive cut": cut.path[i],
      "Hiring freeze": freeze.path[i],
    }));
  }, [state]);

  const queue: QueueItem[] = useMemo(() => {
    if (!state) return [];
    return state.drafts.map((d) => {
      const flag = state.flags.find((f) => f.vendorId === d.vendorId);
      const savings = flag?.savings ?? 0;
      return { ...d, savings, needsApproval: savings > state.config.approvalThreshold };
    });
  }, [state]);

  const shownActions = live.length > 0 ? [...live].reverse() : (state?.actions ?? []);

  if (error && !state) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="font-display text-4xl tracking-[-0.05em]">Dashboard unavailable</h1>
        <p className="mt-4 text-muted">{error}</p>
        <p className="mt-2 text-sm text-slate">
          If the database is missing, run <code className="text-on-card">npm run seed</code> and reload.
        </p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <p className="font-mono text-sm text-muted">Loading...</p>
      </main>
    );
  }

  const [current, cut] = state.forecast.scenarios;
  const mc = state.forecast.monteCarlo[current.label];
  const flagged = state.flags.length;

  return (
    <main className="min-h-screen bg-page">
      {/* Command bar */}
      <div className="border-b border-ink/15 bg-ink text-page">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-6 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-14">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-page/55">
              <span className="h-1.5 w-1.5 rounded-full bg-azure" />
              {state.company.name} / {state.company.headcount} people
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium leading-none tracking-[-0.05em] sm:text-5xl">
              Cash command center
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DataSourceBadge />
            <span className="border border-page/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-page/60">
              {state.config.llmLive ? "LLM live" : "template narration"}
            </span>
            <button
              onClick={reseed}
              disabled={running}
              className="inline-flex items-center gap-2 border border-page/30 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-page hover:text-ink disabled:opacity-50"
            >
              <RotateCcw size={14} /> Reseed
            </button>
            <button
              onClick={runAudit}
              disabled={running}
              className="inline-flex items-center gap-2 bg-azure px-5 py-2.5 text-sm font-medium text-on-card transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Play size={14} />
              {running ? "Auditing..." : "Run audit"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="border-b border-ink/15 bg-[var(--color-series-1)]/10 px-6 py-3 sm:px-10 lg:px-14">
          <p className="mx-auto max-w-[1440px] font-mono text-xs text-ink">{error}</p>
        </div>
      )}

      {/* KPI row */}
      <div className="mx-auto grid max-w-[1440px] gap-px bg-ink/20 px-0 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Monthly burn"
          value={formatCurrency(current.monthlyBurn)}
          sub={`${formatCurrency(state.forecast.vendorSpend)} of that is vendor spend`}
        />
        <StatTile
          label="Monthly revenue"
          value={formatCurrency(state.revenue.mrr)}
          sub={
            state.revenue.source === "stripe"
              ? `${state.revenue.activeSubscriptions} active ${state.revenue.activeSubscriptions === 1 ? "subscription" : "subscriptions"} · Stripe test mode`
              : "Seeded MRR · set DEMO_MODE=false + Stripe key for live"
          }
          accent={state.revenue.source === "stripe" ? "good" : "neutral"}
        />
        <StatTile
          label="Runway"
          value={`${current.runwayMonths} mo`}
          sub={`${mc.p10}–${mc.p90} months across ${mc.trials.toLocaleString()} Monte Carlo trials`}
          accent="warn"
        />
        <StatTile
          label="Flagged vendors"
          value={String(flagged)}
          sub={flagged ? "Expand any flag below for its score breakdown" : "Run an audit to find them"}
        />
        <StatTile
          label="Identified savings"
          value={`${formatCurrency(state.forecast.totalMonthlySavings)}/mo`}
          sub={`Takes runway to ${cut.runwayMonths} months if every remediation lands`}
          accent="good"
        />
      </div>

      {/* Main grid */}
      <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.25fr_1fr] lg:px-14">
        {/* Left column */}
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              Your data
            </h2>
            <UploadPanel
              disabled={running}
              onImported={() => { setLive([]); void load(); }}
            />
          </section>

          <section>
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              Findings
            </h2>
            <div className="bg-card p-5">
              {state.flags.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate">
                  No findings yet. Run an audit.
                </p>
              ) : (
                <div className="space-y-3">
                  {state.flags.map((f) => (
                    <FlagCard key={f.vendorId} flag={f} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              Projection
            </h2>
            <div className="bg-card p-5">
              <Tabs
                defaultTab="runway"
                tabs={[
                  {
                    id: "runway",
                    label: "Runway scenarios",
                    content: (
                      <div>
                        <RunwayChart data={runwaySeries} />
                        <div className="mt-4 space-y-2 border-t border-border-card pt-4">
                          {state.forecast.scenarios.map((s, i) => {
                            const band = state.forecast.monteCarlo[s.label];
                            const color = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)"][i];
                            return (
                              <div key={s.label} className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="inline-flex items-center gap-2 text-sm text-on-card">
                                  <span className="h-2 w-2 shrink-0" style={{ background: color }} />
                                  {s.label}
                                </span>
                                <span className="font-mono text-xs text-muted">
                                  {s.runwayMonths} mo · P10–P90 {band.p10}–{band.p90}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "burn",
                    label: "Burn history",
                    content: <BurnChart data={state.forecast.history} />,
                  },
                  {
                    id: "vendors",
                    label: "Vendors",
                    content: <VendorTable vendors={state.vendors} />,
                  },
                ]}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              Approvals
            </h2>
            <div className="bg-card p-5">
              <ApprovalQueue
                drafts={queue}
                threshold={state.config.approvalThreshold}
                onDecide={decide}
                onNegotiated={load}
              />
            </div>
          </section>
        </div>

        {/* Right column: the agent's reasoning */}
        <div>
          <div className="lg:sticky lg:top-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
                Agent action log
              </h2>
              <div className="flex items-center gap-4">
                {state.flags.length > 0 && (
                  <Link
                    href="/investor-update"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink hover:text-coral"
                  >
                    Investor update <ArrowUpRight size={12} />
                  </Link>
                )}
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/50 hover:text-ink"
                >
                  Overview <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
            <div
              ref={streamRef}
              className="max-h-[calc(100vh-8rem)] overflow-y-auto bg-card p-5"
            >
              <AgentStream actions={shownActions} running={running} status={status} />
            </div>
            <div className="mt-6">
              <AskAgent />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

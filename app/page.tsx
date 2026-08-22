"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  Mail,
  Play,
  Shield,
  TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { AgentAction, Transaction, Vendor } from "@/lib/types";
import { usePlaid } from "@/lib/use-plaid";
import ActionLog from "@/components/action-log";
import AgentDashboard from "@/components/agent-dashboard";
import BankPanel from "@/components/bank-panel";
import BurnChart from "@/components/burn-chart";
import EmailPreview from "@/components/email-preview";
import RunwayChart from "@/components/runway-chart";
import TransactionFeed from "@/components/transaction-feed";
import VendorTable from "@/components/vendor-table";
import { Tabs } from "@/components/tabs";
import {
  CountUp,
  MagneticButton,
  Marquee,
  PointerPanel,
  Reveal,
  Typewriter,
} from "@/components/motion";

const agentSteps = [
  {
    number: "01",
    title: "Observe",
    copy: "Every bank feed, card transaction, and recurring contract is mapped continuously.",
  },
  {
    number: "02",
    title: "Interrogate",
    copy: "Spend is benchmarked against startup category norms and scored by confidence.",
  },
  {
    number: "03",
    title: "Act with you",
    copy: "The fix is drafted, the reasoning shown, and your approval requested.",
  },
];

interface Scenario {
  label: string; description: string; monthlyBurn: number;
  netBurn: number; runwayMonths: number; path: number[];
}

interface State {
  vendors: Vendor[];
  transactions: Transaction[];
  actions: AgentAction[];
  flags: Array<{
    transactionId?: string;
    vendorId: string;
    vendorName: string;
    headline?: string;
    monthlyCost?: number;
    savings?: number;
  }>;
  forecast: {
    vendorSpend: number;
    scenarios: Scenario[];
    history: Array<{ month: string; burn: number; vendorSpend: number }>;
    totalMonthlySavings: number;
  };
  drafts?: Array<{ id: string }>;
  audited?: boolean;
}

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [hasRunAudit, setHasRunAudit] = useState(false);
  const [auditComplete, setAuditComplete] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [liveActions, setLiveActions] = useState<AgentAction[]>([]);
  const [view, setView] = useState<"main" | "agents">("main");
  const plaid = usePlaid();

  const load = useCallback(async (expectedActionId?: string) => {
    const attempts = expectedActionId ? 6 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const res = await fetch(`/api/state?refresh=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const nextState = await res.json() as State;
          const isFresh = !expectedActionId || nextState.actions.some((action) => action.id === expectedActionId);
          if (isFresh) {
            setState(nextState);
            return true;
          }
        }
      } catch {
        // Landing page renders with placeholders if the API is unreachable.
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
    return false;
  }, []);

  // Initial load. setState happens in the async callback, not the effect body,
  // and the guard stops a slow response writing to an unmounted page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = await res.json();
        if (!cancelled) setState(body);
      } catch {
        /* placeholders */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const vendors = useMemo(() => state?.vendors ?? [], [state]);
  const transactions = useMemo(() => state?.transactions ?? [], [state]);
  const actions = hasRunAudit ? [...liveActions].reverse() : [];

  const current = state?.forecast.scenarios[0];
  const burn = current?.monthlyBurn ?? 0;
  const runway = current?.runwayMonths ?? 0;
  const savings = state?.forecast.totalMonthlySavings ?? 0;
  const flagged = state?.flags.length ?? 0;
  const scenarioCount = state?.forecast.scenarios.length ?? 0;
  const draftCount = state?.drafts?.length ?? 0;
  const workflowSummary = !state
    ? "// loading financial workspace"
    : current
      ? `// ${current.runwayMonths} months of cash, ${flagged} ${flagged === 1 ? "flag" : "flags"}, ${formatCurrency(savings)}/mo recoverable`
      : `// ${transactions.length} transactions across ${vendors.length} vendors, ready to forecast`;

  const bankBalance = plaid.balance;
  const plaidReady = plaid.connected && !plaid.loading;
  const auditButtonLabel = isRunning
    ? "Scanning..."
    : auditComplete
      ? "Scan complete — rerun"
      : "Run burn check";

  /**
   * Runs the real audit. Streams the Orchestrator's run to completion, then
   * refreshes the page state so every number on screen comes from the agents.
   */
  const runAudit = async () => {
    setIsRunning(true);
    setHasRunAudit(true);
    setAuditComplete(false);
    setLiveActions([]);
    try {
      const res = await fetch("/api/audit", { method: "POST" });
      if (!res.ok || !res.body) throw new Error("Audit failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestActionId: string | undefined;

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
          if (event.type === "action") {
            latestActionId = event.action.id;
            setLiveActions((previous) => [...previous, event.action]);
          }
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") {
            const refreshed = await load(latestActionId);
            setAuditComplete(refreshed);
            void reader.cancel().catch(() => undefined);
            return;
          }
        }
      }

      const refreshed = await load(latestActionId);
      setAuditComplete(refreshed);
    } catch {
      /* leave the previous state on screen */
    } finally {
      setIsRunning(false);
    }
  };

  // Deep link: /#try (the nav's "Try Burn Shield" button) opens the agent view and
  // scrolls to it. Also reacts to hash changes while the page is open. The
  // view state is set from the hashchange handler / a scheduled callback, not
  // synchronously in the effect body.
  useEffect(() => {
    const apply = () => {
      if (window.location.hash !== "#try") return;
      setView("agents");
      requestAnimationFrame(() => document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    const id = window.setTimeout(apply, 0);
    window.addEventListener("hashchange", apply);
    return () => { window.clearTimeout(id); window.removeEventListener("hashchange", apply); };
  }, []);

  const switchView = (nextView: "main" | "agents") => {
    if (nextView === view) return;
    if (document.startViewTransition) {
      document.startViewTransition(() => setView(nextView));
    } else {
      setView(nextView);
    }
  };

  const categorySpend = useMemo(() => {
    const map = new Map<string, number>();
    vendors.forEach((vendor) => {
      map.set(vendor.category, (map.get(vendor.category) || 0) + vendor.monthlyCost);
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [vendors]);

  const vendorSpend = state?.forecast.vendorSpend ?? burn;
  const otherBurn = Math.max(0, vendorSpend - categorySpend.reduce((sum, c) => sum + c.amount, 0));

  const burnSeries = useMemo(() => state?.forecast.history ?? [], [state]);

  const runwaySeries = useMemo(() => {
    if (!state) return [];
    const [c, cut, freeze] = state.forecast.scenarios;
    return c.path.map((_, i) => ({
      month: `M${i + 1}`,
      Current: c.path[i],
      "Aggressive cut": cut.path[i],
      "Hiring freeze": freeze.path[i],
    }));
  }, [state]);

  const peakBurn = useMemo(
    () => (burnSeries.length ? Math.max(...burnSeries.map((p) => p.burn)) : 0),
    [burnSeries]
  );
  const avgBurn = useMemo(
    () =>
      burnSeries.length
        ? Math.round(burnSeries.reduce((sum, p) => sum + p.burn, 0) / burnSeries.length)
        : 0,
    [burnSeries]
  );

  const flaggedTx = transactions.filter((transaction) => transaction.flagged);
  const draftVendor = vendors.find((v) => v.id === state?.flags[0]?.vendorId);

  /**
   * Ticker copy is derived, never written by hand. Hardcoded claims drift from
   * the data the moment a detector threshold changes.
   */
  const marqueeItems = useMemo(() => {
    if (!state) return ["Awaiting first audit"];
    const found = flaggedTx
      .filter((t) => t.reason)
      .slice(0, 4)
      .map((t) => t.reason as string);
    return [
      `${flagged} ${flagged === 1 ? "anomaly" : "anomalies"} flagged`,
      ...found,
      `${formatCurrency(savings)}/mo recoverable`,
      "Human approval required above threshold",
    ];
  }, [state, flaggedTx, flagged, savings]);

  return (
    <div className="relative overflow-x-clip bg-page text-fg">
      {/* Hero */}
      <section className="relative border-b border-border bg-page text-fg">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.06fr_0.94fr] lg:px-14 lg:py-24">
          <div className="flex flex-col justify-between">
            <div>
              <Reveal delay={80}>
                <h1 className="max-w-3xl font-display text-[clamp(3.25rem,14vw,9rem)] font-medium leading-[0.86] tracking-[-0.065em] sm:text-[clamp(4rem,8.4vw,9rem)] sm:leading-[0.84] sm:tracking-[-0.075em]">
                  Know your
                  <span className="block text-azure">burn.</span>
                  Protect your
                  <span className="block text-azure">cash.</span>
                </h1>
              </Reveal>
            </div>
            <Reveal delay={160}>
              <div className="mt-10 flex flex-col gap-6 sm:mt-14 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
                <p className="max-w-sm text-lg leading-snug tracking-[-0.025em] text-slate">
                  An agentic financial system for early-stage startups that monitors
                  burn rate, surfaces waste, and turns every dollar into more time.
                </p>
                <MagneticButton
                  onClick={runAudit}
                  disabled={isRunning}
                  className="group inline-flex min-h-12 w-full shrink-0 items-center justify-between gap-8 rounded-full border border-border bg-card px-5 py-4 text-sm font-medium text-on-card shadow-sm transition-colors hover:border-azure hover:bg-azure hover:text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                >
                  <span>{auditButtonLabel}</span>
                  <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </MagneticButton>
              </div>
            </Reveal>
          </div>

          {/* Radar */}
          <Reveal delay={220}>
            <PointerPanel className="relative h-full min-h-[380px] overflow-hidden border border-border bg-card p-4 sm:min-h-[430px] sm:p-7">
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between border-b border-border pb-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  <span>Burn monitor / live</span>
                  <span className="text-azure">
                    {isRunning ? "Scanning" : auditComplete ? "Complete" : "Ready"}
                  </span>
                </div>
                <div className="relative mx-auto flex aspect-square w-full max-w-64 items-center justify-center sm:max-w-72">
                  <div className="absolute inset-0 rounded-full border border-fg/10" />
                  <div className="absolute inset-5 rounded-full border border-fg/10" />
                  <div className="absolute inset-12 rounded-full border border-fg/10" />
                  <div className="absolute left-1/2 top-1/2 h-[1px] w-1/2 origin-left bg-gradient-to-r from-azure to-transparent" style={{ transform: "rotate(45deg)" }} />
                  <span className="absolute left-[25%] top-[29%] h-2.5 w-2.5 rounded-full bg-azure" />
                  <span className="absolute right-[19%] top-[44%] h-2 w-2 rounded-full bg-slate" />
                  <span className="absolute bottom-[22%] right-[35%] h-1.5 w-1.5 rounded-full bg-slate/70" />
                  <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full border border-border bg-card-2 text-center shadow-sm">
                    <CountUp
                      value={runway}
                      format={(n) => n.toFixed(0).padStart(2, "0")}
                      className="font-display text-5xl leading-none tracking-[-0.06em] text-on-card"
                    />
                    <span className="mt-1 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                      months out
                    </span>
                  </div>
                </div>
                <div className={`grid gap-px overflow-hidden border border-border bg-card-2 ${plaidReady ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
                  <Metric label="Monthly burn" value={burn} format={formatCurrency} />
                  <Metric label="Flagged vendors" value={flagged} format={(n) => `${Math.round(n)} vendors`} />
                  <Metric label="Savings found" value={savings} format={formatCurrency} />
                  {plaidReady ? (
                    <Metric label="Bank balance" value={bankBalance} format={formatCurrency} />
                  ) : null}
                </div>
              </div>
            </PointerPanel>
          </Reveal>
        </div>

        <div className="border-t border-border py-3">
          <Marquee
            items={marqueeItems}
            className="text-muted"
          />
        </div>
      </section>

      {/* Live dashboard */}
      <section id="try" className="dashboard-view mx-auto max-w-[1440px] scroll-mt-20 px-4 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
        <Reveal>
          <div className="mb-8 flex flex-col justify-between gap-6 border-b border-fg/20 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-sans text-xs font-medium uppercase tracking-wider text-fg/50">
                Live burn dashboard
              </p>
              <h2 className="mt-4 font-display text-5xl font-medium leading-none tracking-[-0.055em] sm:text-6xl">
                {view === "main" ? "Burn dashboard" : "Agent dashboard"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-8">
              {view === "main" ? (
                <>
                  <StatPill label="Burn" value={burn} format={formatCurrency} />
                  <StatPill label="Cash horizon" value={runway} format={(n) => `${Math.round(n)} mo`} />
                  <StatPill label="Flags" value={flagged} format={(n) => `${Math.round(n)}`} />
                  <MagneticButton
                    onClick={runAudit}
                    disabled={isRunning}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 text-sm font-medium text-white hover:bg-azure disabled:opacity-60 sm:w-auto"
                  >
                    <Play size={15} />
                    {auditButtonLabel}
                  </MagneticButton>
                  <MagneticButton
                    onClick={() => switchView("agents")}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-fg px-5 py-3.5 text-sm font-medium text-fg hover:bg-ink hover:text-white sm:w-auto"
                  >
                    Agent dashboard
                  </MagneticButton>
                </>
              ) : (
                <MagneticButton
                  onClick={() => switchView("main")}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-fg px-5 py-3.5 text-sm font-medium text-fg hover:bg-ink hover:text-white sm:w-auto"
                >
                  Burn dashboard
                </MagneticButton>
              )}
            </div>
          </div>
        </Reveal>

        <div>
          {view === "main" ? (
            <>
            {isRunning ? (
              <div className="shimmer-host mb-6 h-0.5 w-full bg-ink/10" />
            ) : null}

        {/* Top grid */}
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <Reveal>
            <PointerPanel className="h-full min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-7">
              <Tabs
                label="Workflow status"
                defaultTab="status"
                tabs={[
                  {
                    id: "status",
                    label: "Status",
                    content: (
                      <div className="flex h-full flex-col justify-between">
                        <h3 className="font-display text-5xl font-light leading-none tracking-[-0.03em] text-on-card/15 sm:text-6xl">
                          burn flow
                        </h3>
                        <div className="mt-10 font-mono text-sm leading-relaxed text-muted">
                          <p>
                            <span className="text-azure">&gt;</span> cash.
                            <span className="text-sky">current</span>();
                          </p>
                          <p className="text-on-card">
                            <Typewriter key={workflowSummary} text={workflowSummary} />
                          </p>
                          <p>
                            <span className="text-azure">&gt;</span> agents.
                            <span className="text-cyan">audit</span>();
                          </p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "agents",
                    label: "Workflow",
                    content: (
                      <div className="space-y-3">
                        <AgentRow
                          icon={BarChart3}
                          name="Classifier"
                          status={isRunning ? "Scanning" : state?.audited ? `${flagged} flagged` : "Ready"}
                        />
                        <AgentRow
                          icon={Mail}
                          name="Negotiator"
                          status={isRunning ? "Waiting" : `${draftCount} ${draftCount === 1 ? "draft" : "drafts"}`}
                        />
                        <AgentRow
                          icon={TrendingDown}
                          name="Forecast"
                          status={scenarioCount ? `${scenarioCount} scenarios` : "Waiting"}
                        />
                        <AgentRow
                          icon={Shield}
                          name="Orchestrator"
                          status={isRunning ? "Running" : state?.audited ? "Complete" : "Ready"}
                        />
                      </div>
                    ),
                  },
                  {
                    id: "alerts",
                    label: "Alerts",
                    content: (
                      <div className="space-y-2">
                        {(state?.flags ?? []).slice(0, 3).map((flag) => (
                          <AlertRow
                            key={flag.transactionId ?? flag.vendorId}
                            message={flag.headline || `${flag.vendorName} requires review`}
                            tone="bad"
                          />
                        ))}
                        {state?.audited && flagged === 0 ? (
                          <AlertRow message="Audit complete — no anomalies detected" tone="good" />
                        ) : state && !state.audited ? (
                          <AlertRow
                            message={`${transactions.length} transactions ready for audit`}
                            tone="good"
                          />
                        ) : !state ? (
                          <AlertRow message="Loading workspace data" tone="good" />
                        ) : null}
                        {current ? (
                          <AlertRow
                            message={`Cash horizon projected at ${current.runwayMonths} months`}
                            tone="good"
                          />
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            </PointerPanel>
          </Reveal>

          <Reveal delay={90}>
            <PointerPanel className="h-full min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-7">
              <Tabs
                label="Cash horizon"
                defaultTab="overview"
                tabs={[
                  {
                    id: "overview",
                    label: "Overview",
                    content: (
                      <div className="text-center">
                        <CountUp
                          value={runway}
                          format={(n) => n.toFixed(0).padStart(2, "0")}
                          className="font-display text-7xl font-light leading-none tracking-[-0.05em] text-on-card sm:text-8xl"
                        />
                        <p className="mt-2 text-sm font-medium text-muted">months</p>
                        <div className="mt-8 h-2 w-full bg-card-2">
                          <div
                            className="bar-grow h-2 bg-gradient-to-r from-azure via-sky to-cyan"
                            style={{ width: `${Math.min((runway / 12) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="mt-6 flex justify-between font-sans text-xs font-medium uppercase tracking-wider text-muted">
                          <span>Today</span>
                          <span>Projected zero cash</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "scenarios",
                    label: "Scenarios",
                    content: (
                      <div>
                        <p className="mb-2 text-center text-sm text-muted">
                          Current, aggressive cut, and hiring-freeze scenarios
                        </p>
                        <RunwayChart data={runwaySeries} />
                      </div>
                    ),
                  },
                  {
                    id: "savings",
                    label: "Savings",
                    content: (
                      <div className="space-y-4">
                        {(state?.flags ?? [])
                          .filter((flag) => (flag.savings ?? 0) > 0)
                          .slice(0, 4)
                          .map((flag) => (
                            <SavingsRow
                              key={flag.transactionId ?? flag.vendorId}
                              label={flag.vendorName}
                              value={flag.savings ?? 0}
                            />
                          ))}
                        {savings === 0 ? (
                          <p className="text-sm text-muted">
                            Run an audit to calculate recoverable spend.
                          </p>
                        ) : null}
                        <div className="mt-4 border-t border-border-card pt-4">
                          <p className="text-sm text-muted">Monthly savings</p>
                          <CountUp
                            value={savings}
                            format={formatCurrency}
                            className="font-display text-3xl font-medium text-azure"
                          />
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </PointerPanel>
          </Reveal>

          <Reveal delay={180}>
            <PointerPanel className="h-full min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-7">
              <Tabs
                label="Spend matrix"
                defaultTab="vendors"
                tabs={[
                  {
                    id: "vendors",
                    label: "Vendors",
                    content: <VendorTable vendors={vendors.slice(0, 6)} />,
                  },
                  {
                    id: "transactions",
                    label: "Transactions",
                    content: <TransactionFeed transactions={transactions.slice(0, 6)} />,
                  },
                  {
                    id: "categories",
                    label: "Categories",
                    content: (
                      <div className="space-y-3">
                        {categorySpend.map(({ category, amount }) => (
                          <div key={category} className="data-row flex items-center justify-between border-b border-border-card pb-2">
                            <span className="text-sm text-muted">{category}</span>
                            <span className="font-mono text-sm text-on-card">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </PointerPanel>
          </Reveal>
        </div>

        {/* Charts + console */}
        <div className={`mb-6 grid gap-6 ${hasRunAudit ? "lg:grid-cols-2" : ""}`}>
          <Reveal>
            <PointerPanel className="h-full min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-7">
              <Tabs
                label="Burn analysis"
                defaultTab="trend"
                tabs={[
                  {
                    id: "trend",
                    label: "Trend",
                    content: (
                      <div>
                        <div className="mb-4 flex flex-wrap items-center gap-6">
                          <StatMini label="Current" value={formatCurrency(burn)} className="text-azure" />
                          <StatMini label="Peak" value={formatCurrency(peakBurn)} className="text-red" />
                          <StatMini label="Avg" value={formatCurrency(avgBurn)} className="text-sky" />
                        </div>
                        <BurnChart data={burnSeries} />
                      </div>
                    ),
                  },
                  {
                    id: "scenarios",
                    label: "Scenarios",
                    content: <RunwayChart data={runwaySeries} />,
                  },
                  {
                    id: "breakdown",
                    label: "Breakdown",
                    content: (
                      <div className="space-y-3">
                        {categorySpend.map(({ category, amount }) => (
                          <BreakdownRow
                            key={category}
                            label={category}
                            amount={amount}
                            total={vendorSpend}
                          />
                        ))}
                        {otherBurn > 0 && (
                          <BreakdownRow label="Other" amount={otherBurn} total={vendorSpend} />
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </PointerPanel>
          </Reveal>

          {hasRunAudit ? (
            <Reveal delay={90}>
              <PointerPanel className="h-full min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-7">
                <Tabs
                  label="Workflow console"
                  defaultTab="log"
                  tabs={[
                    { id: "log", label: "Log", content: <ActionLog actions={actions} /> },
                    {
                      id: "draft",
                      label: "Draft",
                      content: auditComplete && draftVendor ? (
                        <EmailPreview vendor={draftVendor} />
                      ) : (
                        <p className="py-8 text-center text-sm text-muted">
                          No draft yet. Run a burn check and the Negotiator will write one.
                        </p>
                      ),
                    },
                    { id: "flags", label: "Flags", content: <TransactionFeed transactions={auditComplete ? flaggedTx : []} /> },
                  ]}
                />
              </PointerPanel>
            </Reveal>
          ) : null}
        </div>

        {/* Utility row */}
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <PointerPanel className="h-full min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-6">
              <p className="mb-5 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                System health
              </p>
              <div className="space-y-4">
                <HealthBar label="Classifier" value={94} />
                <HealthBar label="Negotiator" value={87} />
                <HealthBar label="Forecast" value={99} />
                <HealthBar label="Orchestrator" value={100} />
              </div>
            </PointerPanel>
          </Reveal>
          <Reveal delay={180}>
            <PointerPanel className="h-full min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-6">
              <p className="mb-5 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                Quick actions
              </p>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction label="Approve all" />
                <QuickAction label="Send emails" />
                <QuickAction label="Export CSV" />
                <QuickAction label="Reset demo" />
              </div>
            </PointerPanel>
          </Reveal>
        </div>

        {/* Bank account */}
        <div className="mt-6">
          <Reveal>
            <PointerPanel className="min-w-0 border border-border-card bg-card p-4 text-on-card sm:p-6">
              <p className="mb-5 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                Bank connection
              </p>
              <BankPanel />
            </PointerPanel>
          </Reveal>
        </div>

        </>
      ) : (
        <AgentDashboard />
      )}
      </div>
      </section>

      {/* Operating loop */}
      <section className="border-t border-border bg-page text-fg">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-10 sm:py-20 lg:px-14 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
            <div className="flex flex-col justify-between">
              <Reveal>
                <div>
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted">
                    Workflow, not wizardry
                  </p>
                  <h2 className="mt-7 max-w-xl font-display text-5xl font-medium leading-[0.9] tracking-[-0.06em] sm:text-7xl">
                    Burn clarity. <span className="text-azure">Human control.</span>
                  </h2>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <p className="mt-12 max-w-md text-lg leading-snug tracking-[-0.025em] text-slate">
                  Every flag shows the benchmark, confidence, and impact on the cash horizon. No
                  action runs without your approval.
                </p>
              </Reveal>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-8">
              {agentSteps.map((step, index) => (
                <Reveal key={step.number} delay={index * 110}>
                  <div className="group grid grid-cols-[56px_1fr] gap-4 border-b border-border py-7 transition-colors last:border-b-0 hover:bg-card-2 sm:grid-cols-[72px_1fr_1.1fr] sm:gap-7">
                    <span className="font-sans text-xs font-medium uppercase tracking-wider text-azure">{step.number}</span>
                    <h3 className="font-display text-2xl tracking-[-0.04em] sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="col-span-2 text-sm leading-relaxed text-muted sm:col-auto">{step.copy}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card text-fg">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 px-4 py-12 sm:px-10 sm:py-14 md:flex-row md:items-end lg:px-14 lg:py-16">
          <Reveal>
            <p className="max-w-3xl font-display text-4xl font-medium leading-[0.9] tracking-[-0.055em] sm:text-6xl">
              Less burn drift. More time to build what matters.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex items-center gap-3 font-sans text-xs font-medium uppercase tracking-wider text-muted">
              <Bot size={15} /> Burn Shield / 2026
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
}) {
  return (
    <div className="bg-card-2 px-3 py-3 transition-colors duration-300 hover:bg-card-3 sm:px-4 sm:py-4">
      <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <CountUp value={value} format={format} className="mt-2 block text-sm font-medium tracking-[-0.02em] text-on-card sm:text-base" />
    </div>
  );
}

function StatPill({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
}) {
  return (
    <div>
      <CountUp value={value} format={format} className="font-display text-2xl font-medium leading-none" />
      <p className="mt-1 font-sans text-xs font-medium uppercase tracking-wider text-fg/50">{label}</p>
    </div>
  );
}

function AgentRow({
  icon: Icon,
  name,
  status,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  name: string;
  status: string;
}) {
  return (
    <div className="data-row flex items-center justify-between border border-border-card bg-card-2 p-3 hover:border-azure">
      <div className="flex items-center gap-3">
        <Icon size={16} className="text-azure" />
        <span className="text-sm font-medium text-on-card">{name}</span>
      </div>
      <span className="font-sans text-xs font-medium uppercase tracking-wider text-muted">{status}</span>
    </div>
  );
}

function AlertRow({ message, tone }: { message: string; tone: "good" | "bad" }) {
  return (
    <div className="data-row flex items-start gap-3 border border-border-card bg-card-2 p-3 hover:border-azure">
      <Bot size={14} className={`mt-0.5 ${tone === "bad" ? "text-red" : "text-azure"}`} />
      <span className={`text-sm ${tone === "bad" ? "text-red" : "text-azure"}`}>{message}</span>
    </div>
  );
}

function SavingsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="data-row flex items-center justify-between border-b border-border-card pb-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm text-on-card">{formatCurrency(value)}</span>
    </div>
  );
}

function StatMini({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div>
      <p className={`font-display text-xl font-medium leading-none ${className}`}>{value}</p>
      <p className="mt-1 font-sans text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  total,
}: {
  label: string;
  amount: number;
  total: number;
}) {
  const pct = Math.round((amount / total) * 100);
  return (
    <div className="group">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted transition-colors group-hover:text-on-card">{label}</span>
        <span className="font-mono text-on-card">{formatCurrency(amount)}</span>
      </div>
      <div className="h-1.5 w-full bg-card-2">
        <div className="bar-grow h-1.5 bg-azure transition-colors group-hover:bg-cyan" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="group">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted transition-colors group-hover:text-on-card">{label}</span>
        <CountUp value={value} format={(n) => `${Math.round(n)}%`} className="font-mono text-on-card" />
      </div>
      <div className="h-2 w-full bg-card-2">
        <div className="bar-grow h-2 bg-gradient-to-r from-azure to-cyan" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function QuickAction({ label }: { label: string }) {
  return (
    <MagneticButton
      className="rounded-lg border border-border-card bg-card-2 px-4 py-3 text-center text-sm font-medium text-on-card transition-colors hover:border-azure hover:bg-azure hover:text-white"
    >
      {label}
    </MagneticButton>
  );
}

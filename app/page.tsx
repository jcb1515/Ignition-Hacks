"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  Mail,
  Play,
  Shield,
  TrendingDown,
} from "lucide-react";
import {
  actions as initialActions,
  burnData as mockBurnData,
  formatCurrency,
  runwayData as mockRunwayData,
} from "@/lib/data";
import type { AgentAction, BurnPoint, ForecastPoint, Transaction, Vendor } from "@/lib/data";
import { useBilling } from "@/lib/use-billing";
import { usePlaid } from "@/lib/use-plaid";
import ActionLog from "@/components/action-log";
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
    copy: "Every recurring charge, contract, and usage signal is mapped continuously.",
  },
  {
    number: "02",
    title: "Interrogate",
    copy: "Anomalies are benchmarked against category norms and scored for confidence.",
  },
  {
    number: "03",
    title: "Act with you",
    copy: "The next move is drafted, the reasoning shown, and approval always requested.",
  },
];

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [actions, setActions] = useState<AgentAction[]>(initialActions);
  const billing = useBilling();
  const plaid = usePlaid();

  const burn = billing.monthlyBurn;
  const bankBalance = plaid.balance;
  const plaidConnected = plaid.connected;
  const plaidReady = plaidConnected && !plaid.loading;
  const runway = plaidReady
    ? Math.max(0, Math.floor(bankBalance / (burn || 1)))
    : 8;
  const savings = 12800;
  const flagged = billing.vendors.filter((vendor) => vendor.status === "flagged").length;

  const runAudit = () => {
    setIsRunning(true);
    setTimeout(() => {
      setActions((previous) => [
        {
          id: `a${previous.length + 1}`,
          timestamp: new Date().toLocaleString(),
          agent: "Orchestrator",
          type: "audit_complete",
          reasoning:
            "Completed full spend audit. Found 3 actionable flags and projected $12,800/mo in savings.",
          humanApproved: false,
          dollarImpact: 12800,
        },
        ...previous,
      ]);
      setIsRunning(false);
    }, 1500);
  };

  const categorySpend = useMemo(() => {
    const map = new Map<string, number>();
    billing.vendors.forEach((vendor) => {
      map.set(vendor.category, (map.get(vendor.category) || 0) + vendor.monthlyCost);
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [billing.vendors]);

  const otherBurn = Math.max(0, burn - categorySpend.reduce((sum, c) => sum + c.amount, 0));

  const burnSeries: BurnPoint[] = useMemo(() => {
    const byMonth = new Map<string, number>();
    billing.transactions.forEach((t) => {
      const month = t.date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + t.amount);
    });
    if (byMonth.size >= 3) {
      return Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, amount]) => ({
          month: new Date(`${month}-01`).toLocaleString("en-US", { month: "short" }),
          burn: Math.round(amount),
        }));
    }
    const ratio = burn / 38400;
    return mockBurnData.map((p) => ({ ...p, burn: Math.round(p.burn * ratio) }));
  }, [billing.transactions, burn]);

  const runwaySeries: ForecastPoint[] = useMemo(() => {
    const start = plaidReady ? bankBalance : burn * runway;
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(d.toLocaleString("en-US", { month: "short" }));
    }
    const currentBurn = burn;
    const cutBurn = Math.max(0, burn - savings);
    const freezeBurn = Math.round(burn * 0.75);
    return months.map((month, i) => {
      const m = i + 1;
      return {
        month,
        current: Math.max(0, start - currentBurn * m),
        aggressiveCut: Math.max(0, start - cutBurn * m),
        hiringFreeze: Math.max(0, start - freezeBurn * m),
      };
    });
  }, [burn, runway, savings, bankBalance, plaidReady]);

  const peakBurn = useMemo(
    () => Math.max(...burnSeries.map((p) => p.burn), burn),
    [burnSeries, burn]
  );
  const avgBurn = useMemo(
    () =>
      Math.round(
        burnSeries.reduce((sum, p) => sum + p.burn, 0) /
          (burnSeries.length || 1)
      ),
    [burnSeries]
  );

  const flaggedTx = billing.transactions.filter((transaction) => transaction.flagged);

  return (
    <div className="relative overflow-hidden bg-page text-fg">
      {/* Hero */}
      <section className="relative border-b border-border bg-page text-fg">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.06fr_0.94fr] lg:px-14 lg:py-24">
          <div className="flex flex-col justify-between">
            <div>
              <Reveal>
                <p className="mb-8 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
                  <span className="relative flex h-2 w-2">
                    <span className="relative h-2 w-2 rounded-full bg-azure" />
                  </span>
                  Agent online / watching spend
                </p>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="max-w-3xl font-display text-[clamp(4rem,8.4vw,9rem)] font-medium leading-[0.84] tracking-[-0.075em]">
                  Find what is
                  <span className="block text-azure">leaking.</span>
                  Keep what
                  <span className="block text-azure">matters.</span>
                </h1>
              </Reveal>
            </div>
            <Reveal delay={160}>
              <div className="mt-14 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-sm text-lg leading-snug tracking-[-0.025em] text-slate">
                  An agentic cash burn auditor that finds waste, drafts the fix, and
                  turns it into another month of runway.
                </p>
                <MagneticButton
                  onClick={runAudit}
                  disabled={isRunning}
                  className="group inline-flex shrink-0 items-center justify-between gap-8 rounded-full border border-border bg-card px-5 py-4 text-sm font-medium text-on-card shadow-sm transition-colors hover:border-azure hover:bg-azure hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  <span>{isRunning ? "Auditing..." : "Run a live audit"}</span>
                  <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </MagneticButton>
              </div>
            </Reveal>
          </div>

          {/* Radar */}
          <Reveal delay={220}>
            <PointerPanel className="relative h-full min-h-[430px] overflow-hidden border border-border bg-card p-5 sm:p-7">
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between border-b border-border pb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  <span>Runway radar / live</span>
                  <span className="text-azure">{isRunning ? "Scanning" : "Nominal"}</span>
                </div>
                <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
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
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      months out
                    </span>
                  </div>
                </div>
                <div className={`grid gap-px overflow-hidden border border-border bg-card-2 ${plaidReady ? "grid-cols-4" : "grid-cols-3"}`}>
                  <Metric label="Monthly burn" value={burn} format={formatCurrency} />
                  <Metric label="Flagged" value={flagged} format={(n) => `${Math.round(n)} vendors`} />
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
            items={[
              "Plaid sandbox connected",
              "Stripe test mode synced",
              "3 anomalies flagged",
              "Twilio 2.3x category average",
              "Confluence duplicates Notion",
              "Segment usage flatlined",
              "Human approval required",
            ]}
            className="text-muted"
          />
        </div>
      </section>

      {/* Live dashboard */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-10 lg:px-14 lg:py-20">
        <Reveal>
          <div className="mb-8 flex flex-col justify-between gap-6 border-b border-fg/20 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg/50">
                Live agent dashboard
              </p>
              <h2 className="mt-4 font-display text-5xl font-medium leading-none tracking-[-0.055em] sm:text-6xl">
                Runway Radar
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <StatPill label="Burn" value={burn} format={formatCurrency} />
              <StatPill label="Runway" value={runway} format={(n) => `${Math.round(n)} mo`} />
              <StatPill label="Flags" value={flagged} format={(n) => `${Math.round(n)}`} />
              <MagneticButton
                onClick={runAudit}
                disabled={isRunning}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3.5 text-sm font-medium text-white hover:bg-azure disabled:opacity-60"
              >
                <Play size={15} />
                {isRunning ? "Running..." : "Run audit"}
              </MagneticButton>
            </div>
          </div>
        </Reveal>

        {isRunning ? (
          <div className="shimmer-host mb-6 h-0.5 w-full bg-ink/10" />
        ) : null}

        {/* Top grid */}
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <Reveal>
            <PointerPanel className="h-full border border-border-card bg-card p-7 text-on-card">
              <Tabs
                label="Agent status"
                defaultTab="status"
                tabs={[
                  {
                    id: "status",
                    label: "Status",
                    content: (
                      <div className="flex h-full flex-col justify-between">
                        <h3 className="font-display text-5xl font-light leading-none tracking-[-0.03em] text-on-card/15 sm:text-6xl">
                          hello founder
                        </h3>
                        <div className="mt-10 font-mono text-sm leading-relaxed text-muted">
                          <p>
                            <span className="text-azure">&gt;</span> runway.
                            <span className="text-sky">current</span>();
                          </p>
                          <p className="text-on-card">
                            <Typewriter text="// 8 months, 3 flags, $12.8k recoverable" />
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
                    label: "Agents",
                    content: (
                      <div className="space-y-3">
                        <AgentRow icon={BarChart3} name="Classifier" status="Online" />
                        <AgentRow icon={Mail} name="Negotiator" status="Drafting" />
                        <AgentRow icon={TrendingDown} name="Forecast" status="Idle" />
                        <AgentRow icon={Shield} name="Orchestrator" status={isRunning ? "Running" : "Ready"} />
                      </div>
                    ),
                  },
                  {
                    id: "alerts",
                    label: "Alerts",
                    content: (
                      <div className="space-y-2">
                        <AlertRow message="Twilio is 2.3x category average" tone="bad" />
                        <AlertRow message="Confluence duplicates Notion" tone="bad" />
                        <AlertRow message="Segment usage flatlined" tone="bad" />
                        <AlertRow message="Runway projection updated" tone="good" />
                      </div>
                    ),
                  },
                ]}
              />
            </PointerPanel>
          </Reveal>

          <Reveal delay={90}>
            <PointerPanel className="h-full border border-border-card bg-card p-7 text-on-card">
              <Tabs
                label="Runway"
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
                        <div className="mt-6 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
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
                          Current, aggressive cut, and hiring freeze
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
                        <SavingsRow label="Twilio renegotiation" value={3000} />
                        <SavingsRow label="Confluence cancellation" value={420} />
                        <SavingsRow label="Segment tier downgrade" value={2200} />
                        <SavingsRow label="Duplicate tool audit" value={180} />
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
            <PointerPanel className="h-full border border-border-card bg-card p-7 text-on-card">
              <Tabs
                label="Vendor matrix"
                defaultTab="vendors"
                tabs={[
                  {
                    id: "vendors",
                    label: "Vendors",
                    content: <VendorTable vendors={billing.vendors.slice(0, 6)} />,
                  },
                  {
                    id: "transactions",
                    label: "Transactions",
                    content: <TransactionFeed transactions={billing.transactions.slice(0, 6)} />,
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
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <PointerPanel className="h-full border border-border-card bg-card p-7 text-on-card">
              <Tabs
                label="Burn lab"
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
                            total={burn}
                          />
                        ))}
                        {otherBurn > 0 && (
                          <BreakdownRow label="Other" amount={otherBurn} total={burn} />
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </PointerPanel>
          </Reveal>

          <Reveal delay={90}>
            <PointerPanel className="h-full border border-border-card bg-card p-7 text-on-card">
              <Tabs
                label="Agent console"
                defaultTab="log"
                tabs={[
                  { id: "log", label: "Log", content: <ActionLog actions={actions} /> },
                  {
                    id: "draft",
                    label: "Draft",
                    content: (
                    <EmailPreview
                      vendor={
                        billing.vendors.find((vendor) => vendor.name === "Twilio") ||
                        billing.vendors[0]
                      }
                    />
                  ),
                  },
                  { id: "flags", label: "Flags", content: <TransactionFeed transactions={flaggedTx} /> },
                ]}
              />
            </PointerPanel>
          </Reveal>
        </div>

        {/* Utility row */}
        <div className="grid gap-6 md:grid-cols-3">
          <Reveal>
            <PointerPanel className="h-full border border-border-card bg-card p-6 text-on-card">
              <p className="mb-5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                Agent health
              </p>
              <div className="space-y-4">
                <HealthBar label="Classifier" value={94} />
                <HealthBar label="Negotiator" value={87} />
                <HealthBar label="Forecast" value={99} />
                <HealthBar label="Orchestrator" value={100} />
              </div>
            </PointerPanel>
          </Reveal>
          <Reveal delay={90}>
            <PointerPanel className="h-full border border-border-card bg-card p-6 text-on-card">
              <p className="mb-5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                Top flags this month
              </p>
              <div className="space-y-3">
                {billing.vendors
                  .filter((vendor) => vendor.status === "flagged")
                  .slice(0, 3)
                  .map((vendor) => (
                    <FlagRow
                      key={vendor.id}
                      name={vendor.name}
                      amount={vendor.monthlyCost}
                      reason={vendor.monthlyCost > 3000 ? "Over benchmark" : "Category flag"}
                    />
                  ))}
              </div>
            </PointerPanel>
          </Reveal>
          <Reveal delay={180}>
            <PointerPanel className="h-full border border-border-card bg-card p-6 text-on-card">
              <p className="mb-5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
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
            <PointerPanel className="border border-border-card bg-card p-6 text-on-card">
              <p className="mb-5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                Bank account
              </p>
              <BankPanel />
            </PointerPanel>
          </Reveal>
        </div>
      </section>

      {/* Operating loop */}
      <section className="border-t border-border bg-page text-fg">
        <div className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
            <div className="flex flex-col justify-between">
              <Reveal>
                <div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                    Agentic, not automatic
                  </p>
                  <h2 className="mt-7 max-w-xl font-display text-5xl font-medium leading-[0.9] tracking-[-0.06em] sm:text-7xl">
                    Clear reasoning. <span className="text-azure">Human control.</span>
                  </h2>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <p className="mt-12 max-w-md text-lg leading-snug tracking-[-0.025em] text-slate">
                  Every flag carries its benchmark, confidence, and dollar impact. Nothing
                  leaves the building without your approval.
                </p>
              </Reveal>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              {agentSteps.map((step, index) => (
                <Reveal key={step.number} delay={index * 110}>
                  <div className="group grid grid-cols-[56px_1fr] gap-4 border-b border-border py-7 transition-colors last:border-b-0 hover:bg-card-2 sm:grid-cols-[72px_1fr_1.1fr] sm:gap-7">
                    <span className="font-mono text-[10px] tracking-[0.12em] text-azure">{step.number}</span>
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
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 px-6 py-14 sm:px-10 md:flex-row md:items-end lg:px-14 lg:py-16">
          <Reveal>
            <p className="max-w-3xl font-display text-4xl font-medium leading-[0.9] tracking-[-0.055em] sm:text-6xl">
              Less cash leakage. More time to build something that lasts.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              <Bot size={15} /> Runway Radar / 2026
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
      <p className="font-mono text-[8px] uppercase tracking-[0.11em] text-muted">{label}</p>
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
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-fg/50">{label}</p>
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
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{status}</span>
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
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</p>
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

function FlagRow({
  name,
  amount,
  reason,
}: {
  name: string;
  amount: number;
  reason: string;
}) {
  return (
    <div className="data-row flex items-center justify-between border border-border-card bg-card-2 p-3 hover:border-red">
      <div>
        <p className="text-sm font-medium text-on-card">{name}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{reason}</p>
      </div>
      <span className="font-mono text-sm font-medium text-red">{formatCurrency(amount)}</span>
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

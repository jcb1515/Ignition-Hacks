"use client";

import { useMemo, useState } from "react";
import { Play, CheckCircle, AlertCircle, Bot, Mail, TrendingDown, Shield, BarChart3 } from "lucide-react";
import {
  formatCurrency,
  vendors as initialVendors,
  transactions,
  actions as initialActions,
  burnData,
  runwayData,
} from "@/lib/data";
import type { Vendor, AgentAction } from "@/lib/data";
import BurnChart from "@/components/burn-chart";
import RunwayChart from "@/components/runway-chart";
import VendorTable from "@/components/vendor-table";
import TransactionFeed from "@/components/transaction-feed";
import ActionLog from "@/components/action-log";
import EmailPreview from "@/components/email-preview";
import { Tabs } from "@/components/tabs";

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [actions, setActions] = useState<AgentAction[]>(initialActions);
  const [vendors] = useState<Vendor[]>(initialVendors);

  const runAudit = () => {
    setIsRunning(true);
    setTimeout(() => {
      setActions((prev) => [
        {
          id: `a${prev.length + 1}`,
          timestamp: new Date().toLocaleString(),
          agent: "Orchestrator",
          type: "audit_complete",
          reasoning:
            "Completed full spend audit. Found 3 actionable flags and projected $12,800/mo in savings.",
          humanApproved: false,
          dollarImpact: 12800,
        },
        ...prev,
      ]);
      setIsRunning(false);
    }, 1500);
  };

  const burn = 38400;
  const runway = 8;
  const savings = 12800;
  const flagged = vendors.filter((v) => v.status === "flagged").length;

  const categorySpend = useMemo(() => {
    const map = new Map<string, number>();
    vendors.forEach((v) => {
      map.set(v.category, (map.get(v.category) || 0) + v.monthlyCost);
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [vendors]);

  const flaggedTx = transactions.filter((t) => t.flagged).slice(0, 5);

  return (
    <div className="min-h-full bg-page px-6 py-6">
      <div className="mx-auto max-w-[1340px]">
        {/* Header bar */}
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl bg-card p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Live agent dashboard
            </p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.015em] text-on-card">
              Runway Radar
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-6 text-sm text-muted sm:flex">
              <StatPill value={formatCurrency(burn)} label="Burn" />
              <StatPill value={`${runway} mo`} label="Runway" />
              <StatPill value={flagged.toString()} label="Flags" />
            </div>
            <button
              onClick={runAudit}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-full bg-on-card px-5 py-2.5 text-sm font-medium text-card hover:bg-canvas disabled:opacity-50"
            >
              <Play size={16} />
              {isRunning ? "Running..." : "Run audit"}
            </button>
          </div>
        </div>

        {/* Top grid */}
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          {/* Agent status card */}
          <div className="relative overflow-hidden rounded-3xl bg-card p-8">
            <Tabs
              label="Agent status"
              defaultTab="status"
              tabs={[
                {
                  id: "status",
                  label: "Status",
                  content: (
                    <div className="flex h-full flex-col justify-between">
                      <h2 className="font-display text-6xl font-light leading-none tracking-[-0.02em] text-on-card/10 sm:text-7xl">
                        hello founder
                      </h2>
                      <div className="mt-12 font-mono text-sm leading-relaxed text-muted">
                        <p>
                          <span className="text-mint">&gt;</span> runway.{" "}
                          <span className="text-blue">current</span>();
                        </p>
                        <p className="text-on-card">
                          // 8 months, 3 flags, $12.8k saved
                        </p>
                        <p>
                          <span className="text-mint">&gt;</span> agents.{" "}
                          <span className="text-pink">audit</span>();
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
                      <AgentRow
                        icon={BarChart3}
                        name="Classifier"
                        status="Online"
                        color="text-mint"
                      />
                      <AgentRow
                        icon={Mail}
                        name="Negotiator"
                        status="Drafting"
                        color="text-pink"
                      />
                      <AgentRow
                        icon={TrendingDown}
                        name="Forecast"
                        status="Idle"
                        color="text-blue"
                      />
                      <AgentRow
                        icon={Shield}
                        name="Orchestrator"
                        status="Running"
                        color="text-yellow"
                      />
                    </div>
                  ),
                },
                {
                  id: "alerts",
                  label: "Alerts",
                  content: (
                    <div className="space-y-2">
                      <AlertRow
                        icon={Bot}
                        message="Twilio is 2.3x category average"
                        color="text-red"
                      />
                      <AlertRow
                        icon={Bot}
                        message="Confluence duplicates Notion"
                        color="text-red"
                      />
                      <AlertRow
                        icon={Bot}
                        message="Segment usage flatlined"
                        color="text-red"
                      />
                      <AlertRow
                        icon={Bot}
                        message="Runway projection updated"
                        color="text-mint"
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Runway card */}
          <div className="rounded-3xl bg-card p-8">
            <Tabs
              label="Runway"
              defaultTab="overview"
              tabs={[
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                    <div className="text-center">
                      <p className="font-display text-8xl font-light leading-none tracking-[-0.04em] text-on-card">
                        {runway.toString().padStart(2, "0")}
                      </p>
                      <p className="mt-2 text-sm font-medium text-muted">
                        months
                      </p>
                      <div className="mt-8 h-2 w-full rounded-full bg-card-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-pink via-blue to-mint"
                          style={{ width: `${(runway / 12) * 100}%` }}
                        />
                      </div>
                      <div className="mt-6 flex justify-between text-xs text-muted">
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
                      <RunwayChart data={runwayData} />
                    </div>
                  ),
                },
                {
                  id: "savings",
                  label: "Savings",
                  content: (
                    <div className="space-y-4">
                      <SavingsRow
                        label="Twilio renegotiation"
                        value={3000}
                      />
                      <SavingsRow
                        label="Confluence cancellation"
                        value={420}
                      />
                      <SavingsRow
                        label="Segment tier downgrade"
                        value={2200}
                      />
                      <SavingsRow label="Duplicate tool audit" value={180} />
                      <div className="mt-4 border-t border-border-card pt-4">
                        <p className="text-sm text-muted">Monthly savings</p>
                        <p className="font-display text-3xl font-medium text-mint">
                          {formatCurrency(savings)}
                        </p>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Vendor matrix */}
          <div className="rounded-3xl bg-card p-8">
            <Tabs
              label="Vendor matrix"
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
                  content: (
                    <TransactionFeed transactions={transactions.slice(0, 6)} />
                  ),
                },
                {
                  id: "categories",
                  label: "Categories",
                  content: (
                    <div className="space-y-3">
                      {categorySpend.map(({ category, amount }) => (
                        <div
                          key={category}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-muted">{category}</span>
                          <span className="font-medium text-on-card">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>

        {/* Bottom grid */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-card p-8">
            <Tabs
              label="Burn lab"
              defaultTab="trend"
              tabs={[
                {
                  id: "trend",
                  label: "Trend",
                  content: (
                    <div>
                      <div className="mb-4 flex items-center gap-4">
                        <StatMini label="Current" value={formatCurrency(burn)} color="text-mint" />
                        <StatMini label="Peak" value={formatCurrency(41000)} color="text-pink" />
                        <StatMini label="Avg" value={formatCurrency(35800)} color="text-blue" />
                      </div>
                      <BurnChart data={burnData} />
                    </div>
                  ),
                },
                {
                  id: "scenarios",
                  label: "Scenarios",
                  content: <RunwayChart data={runwayData} />,
                },
                {
                  id: "breakdown",
                  label: "Breakdown",
                  content: (
                    <div className="space-y-3">
                      <BreakdownRow label="Communication" amount={8800} total={burn} />
                      <BreakdownRow label="Infrastructure" amount={2400} total={burn} />
                      <BreakdownRow label="Analytics" amount={3200} total={burn} />
                      <BreakdownRow label="Design" amount={1080} total={burn} />
                      <BreakdownRow label="Productivity" amount={1092} total={burn} />
                      <BreakdownRow label="Other" amount={22028} total={burn} />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className="rounded-3xl bg-card p-8">
            <Tabs
              label="Agent console"
              defaultTab="log"
              tabs={[
                {
                  id: "log",
                  label: "Log",
                  content: <ActionLog actions={actions} />,
                },
                {
                  id: "draft",
                  label: "Draft",
                  content: (
                    <EmailPreview
                      vendor={vendors.find((v) => v.name === "Twilio")!}
                    />
                  ),
                },
                {
                  id: "flags",
                  label: "Flags",
                  content: <TransactionFeed transactions={flaggedTx} />,
                },
              ]}
            />
          </div>
        </div>

        {/* Extra row with more cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl bg-card p-6">
            <p className="mb-4 font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Agent health
            </p>
            <div className="space-y-4">
              <HealthBar label="Classifier" value={94} color="bg-mint" />
              <HealthBar label="Negotiator" value={87} color="bg-pink" />
              <HealthBar label="Forecast" value={99} color="bg-blue" />
              <HealthBar label="Orchestrator" value={100} color="bg-yellow" />
            </div>
          </div>
          <div className="rounded-3xl bg-card p-6">
            <p className="mb-4 font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Top flags this month
            </p>
            <div className="space-y-3">
              <FlagRow name="Twilio" amount={6400} reason="Over benchmark" />
              <FlagRow name="Segment" amount={3200} reason="Flat usage" />
              <FlagRow name="Confluence" amount={420} reason="Duplicate" />
            </div>
          </div>
          <div className="rounded-3xl bg-card p-6">
            <p className="mb-4 font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Quick actions
            </p>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction label="Approve all" />
              <QuickAction label="Send emails" />
              <QuickAction label="Export CSV" />
              <QuickAction label="Reset demo" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-lg font-medium leading-none text-on-card">
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function AgentRow({
  icon: Icon,
  name,
  status,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  name: string;
  status: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-card-2 p-3">
      <div className="flex items-center gap-3">
        <Icon size={16} className={color} />
        <span className="text-sm font-medium text-on-card">{name}</span>
      </div>
      <span className="text-xs text-muted">{status}</span>
    </div>
  );
}

function AlertRow({
  icon: Icon,
  message,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  message: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-card-2 p-3">
      <Icon size={14} className={`mt-0.5 ${color}`} />
      <span className={`text-sm ${color === "text-red" ? "text-red" : color}`}>
        {message}
      </span>
    </div>
  );
}

function SavingsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-medium text-on-card">{formatCurrency(value)}</span>
    </div>
  );
}

function StatMini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <p className={`font-display text-xl font-medium leading-none ${color}`}>
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
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
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-on-card">{formatCurrency(amount)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-card-2">
        <div
          className="h-1.5 rounded-full bg-mint"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function HealthBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-on-card">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-card-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
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
    <div className="flex items-center justify-between rounded-lg bg-card-2 p-3">
      <div>
        <p className="text-sm font-medium text-on-card">{name}</p>
        <p className="text-xs text-muted">{reason}</p>
      </div>
      <span className="text-sm font-medium text-red">{formatCurrency(amount)}</span>
    </div>
  );
}

function QuickAction({ label }: { label: string }) {
  return (
    <button className="rounded-xl border border-border-card bg-card-2 px-4 py-3 text-center text-sm font-medium text-on-card transition-colors hover:border-muted">
      {label}
    </button>
  );
}

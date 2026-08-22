import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Bot, Check, CircleAlert, ShieldCheck } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { forecast } from "@/lib/agents/forecast";
import { getActions, getFlaggedTransactions, getVendors } from "@/lib/db/queries";
import { formatCurrency } from "@/lib/types";
import type { AgentAction, Vendor } from "@/lib/types";

// Reads the database on every request; the numbers here are the same ones the
// dashboard shows, not a separate set of hardcoded marketing figures.
export const dynamic = "force-dynamic";

const agentSteps = [
  {
    number: "01",
    title: "Observe",
    copy: "Continuously map every recurring charge, contract, and usage signal.",
  },
  {
    number: "02",
    title: "Interrogate",
    copy: "Find the spend patterns that do not belong in a growing business.",
  },
  {
    number: "03",
    title: "Act with you",
    copy: "Draft the next move, show the reasoning, and wait for approval.",
  },
];

interface PageData {
  burn: number;
  runway: number;
  savings: number;
  flaggedNames: string[];
  flaggedVendors: Vendor[];
  actions: AgentAction[];
  ready: boolean;
}

/** The landing page must render even on a fresh checkout with no database. */
function load(): PageData {
  try {
    const vendors = getVendors();
    if (vendors.length === 0) throw new Error("not seeded");

    const flaggedTx = getFlaggedTransactions();
    const flaggedIds = new Set(flaggedTx.map((t) => t.vendorId));
    const flaggedVendors = vendors.filter((v) => flaggedIds.has(v.id));

    const flags = flaggedTx.map((t) => {
      const v = vendors.find((x) => x.id === t.vendorId);
      let features = [];
      try { features = t.features ? JSON.parse(t.features) : []; } catch { features = []; }
      return {
        transactionId: t.id, vendorId: t.vendorId, vendorName: t.vendorName,
        kind: "overpriced" as const, confidence: t.confidence ?? 0,
        features, headline: t.reason ?? "", monthlyCost: v?.monthlyCost ?? t.amount,
      };
    });

    const f = forecast(flags);
    return {
      burn: f.scenarios[0].monthlyBurn,
      runway: f.scenarios[0].runwayMonths,
      savings: f.totalMonthlySavings,
      flaggedNames: [...new Set(flaggedTx.map((t) => t.vendorName))],
      flaggedVendors,
      actions: getActions(3),
      ready: true,
    };
  } catch {
    return {
      burn: 0, runway: 0, savings: 0, flaggedNames: [],
      flaggedVendors: [], actions: [], ready: false,
    };
  }
}

export default function Home() {
  const d = load();
  const runwayLabel = d.ready ? d.runway.toFixed(1).padStart(4, "0") : "--";

  return (
    <div className="overflow-hidden bg-page text-ink">
      {/* Hero */}
      <section className="border-b border-ink/15 bg-ink text-page">
        <div className="mx-auto grid min-h-[680px] max-w-[1440px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-14 lg:py-24">
          <div className="flex max-w-3xl flex-col justify-between">
            <div>
              <p className="mb-8 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-page/55">
                <span className="h-2 w-2 rounded-full bg-lime" />
                Cash intelligence, continuously
              </p>
              <h1 className="max-w-3xl font-display text-[clamp(4.4rem,9vw,9.8rem)] font-medium leading-[0.83] tracking-[-0.075em] text-page">
                Find what is
                <span className="block text-lime">leaking.</span>
                Keep what
                <span className="block text-lime">matters.</span>
              </h1>
            </div>
            <div className="mt-16 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-sm text-lg leading-snug tracking-[-0.025em] text-page/70 sm:text-xl">
                An autonomous cash operator that surfaces waste and turns it into another month of runway.
              </p>
              <Link
                href="/dashboard"
                className="group inline-flex shrink-0 items-center justify-between gap-8 border border-page/35 px-5 py-4 text-sm font-medium transition-colors hover:bg-page hover:text-ink"
              >
                <span>Open the command center</span>
                <ArrowUpRight className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} />
              </Link>
            </div>
          </div>

          <div className="relative min-h-[430px] overflow-hidden border border-page/20 bg-[#151817] p-5 sm:p-7">
            <div className="signal-grid absolute inset-0 opacity-50" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between border-b border-page/15 pb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-page/60">
                <span>Runway radar / {COMPANY.name}</span>
                <span className="text-lime">{d.ready ? "System online" : "Awaiting seed"}</span>
              </div>
              <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                <div className="absolute inset-0 rounded-full border border-page/15" />
                <div className="absolute inset-5 rounded-full border border-page/15" />
                <div className="absolute inset-12 rounded-full border border-page/15" />
                <div className="absolute inset-0 rounded-full border border-lime/80" style={{ clipPath: "inset(0 46% 0 0)" }} />
                <div className="absolute left-1/2 top-1/2 h-[1px] w-[47%] origin-left -rotate-[31deg] bg-lime/80" />
                <div className="absolute left-[25%] top-[29%] h-2.5 w-2.5 rounded-full bg-lime shadow-[0_0_30px_8px_rgba(206,250,79,0.24)]" />
                <div className="absolute right-[19%] top-[44%] h-2 w-2 rounded-full bg-page" />
                <div className="absolute bottom-[22%] right-[35%] h-1.5 w-1.5 rounded-full bg-page/60" />
                <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full border border-page/20 bg-ink/85 text-center backdrop-blur">
                  <span className="font-display text-5xl leading-none tracking-[-0.06em]">{runwayLabel}</span>
                  <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-page/55">months out</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px border border-page/15 bg-page/15">
                <Metric label="Monthly burn" value={d.ready ? formatCurrency(d.burn) : "--"} />
                <Metric label="At risk" value={`${d.flaggedNames.length} vendors`} />
                <Metric label="Potential save" value={d.ready ? formatCurrency(d.savings) : "--"} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signal / projection / recommendation */}
      <section className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
        <div className="mb-12 grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink/50">The cash command center</p>
          <h2 className="max-w-4xl font-display text-5xl font-medium leading-[0.9] tracking-[-0.06em] sm:text-7xl">
            The decisions that extend runway should not hide in a spreadsheet.
          </h2>
        </div>

        <div className="grid border-t border-ink/20 lg:grid-cols-3">
          <article className="group min-h-[365px] border-b border-ink/20 py-6 lg:border-b-0 lg:border-r lg:pr-6">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
              <span>01 / Signal</span>
              <span className="flex items-center gap-2 text-lime"><span className="h-1.5 w-1.5 rounded-full bg-lime" />Monitoring</span>
            </div>
            <div className="mt-16">
              <p className="font-display text-[clamp(5rem,8vw,8.5rem)] font-medium leading-none tracking-[-0.08em]">
                {String(d.flaggedNames.length).padStart(2, "0")}
              </p>
              <p className="mt-2 max-w-56 text-lg leading-snug tracking-[-0.03em]">
                material vendor signals require attention this month.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {d.flaggedNames.map((name) => (
                <span key={name} className="border border-ink/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]">
                  {name}
                </span>
              ))}
            </div>
          </article>

          <article className="min-h-[365px] border-b border-ink/20 py-6 lg:border-b-0 lg:border-r lg:px-6">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
              <span>02 / Projection</span>
              <ArrowDownRight size={16} />
            </div>
            <div className="mt-14">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-display text-[clamp(4rem,7vw,7.5rem)] font-medium leading-none tracking-[-0.08em]">
                    {runwayLabel}
                  </p>
                  <p className="mt-2 text-lg tracking-[-0.03em]">Months at current burn</p>
                </div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">Baseline</p>
              </div>
              <div className="relative mt-10 h-24 overflow-hidden border-y border-ink/20">
                <div className="absolute bottom-0 left-0 h-[40%] w-full bg-lime/90" />
                <svg viewBox="0 0 400 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 29 C38 25 48 45 84 42 S132 16 168 25 S219 66 251 48 S305 38 340 70 S375 90 400 80" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink/60">
              {d.ready
                ? `Burn is stable, but ${d.flaggedNames.length} preventable charges are shortening the horizon.`
                : "Seed the database to see a live projection."}
            </p>
          </article>

          <article className="min-h-[365px] py-6 lg:pl-6">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
              <span>03 / Recommendation</span>
              <CircleAlert size={16} className="text-coral" />
            </div>
            <div className="mt-11 divide-y divide-ink/15 border-y border-ink/15">
              {d.flaggedVendors.map((vendor, index) => (
                <div key={vendor.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[10px] text-ink/45">0{index + 1}</span>
                    <div>
                      <p className="text-base font-medium tracking-[-0.025em]">{vendor.name}</p>
                      <p className="mt-0.5 text-xs text-ink/50">{vendor.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{formatCurrency(vendor.monthlyCost)}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-coral">Review now</p>
                  </div>
                </div>
              ))}
              {d.flaggedVendors.length === 0 && (
                <p className="py-6 text-sm text-ink/50">Nothing flagged yet — run an audit.</p>
              )}
            </div>
            <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 text-sm font-medium underline decoration-ink/35 underline-offset-4 transition-colors hover:text-coral">
              See the full audit <ArrowUpRight size={15} />
            </Link>
          </article>
        </div>
      </section>

      {/* Agentic, not automatic */}
      <section className="bg-ink text-page">
        <div className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
            <div className="flex flex-col justify-between">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-page/55">Agentic, not automatic</p>
                <h2 className="mt-7 max-w-xl font-display text-5xl font-medium leading-[0.9] tracking-[-0.06em] sm:text-7xl">
                  Clear reasoning. <span className="text-lime">Human control.</span>
                </h2>
              </div>
              <p className="mt-12 max-w-md text-lg leading-snug tracking-[-0.025em] text-page/65">
                Runway Radar does the investigation, creates a recommendation, and makes the impact legible before any action is taken.
              </p>
            </div>
            <div className="border-t border-page/20">
              {agentSteps.map((step) => (
                <div key={step.number} className="grid grid-cols-[56px_1fr_auto] gap-4 border-b border-page/20 py-7 sm:grid-cols-[72px_1fr_1.1fr] sm:gap-7">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-lime">{step.number}</span>
                  <h3 className="font-display text-2xl tracking-[-0.04em] sm:text-3xl">{step.title}</h3>
                  <p className="col-span-2 text-sm leading-relaxed text-page/55 sm:col-auto">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recent agent activity */}
      <section className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-ink/20 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink/50">Recent agent activity</p>
            <h2 className="mt-4 font-display text-5xl font-medium leading-none tracking-[-0.055em]">Nothing hidden.</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink/60">
            Every recommendation contains a trail your team can review, challenge, and approve.
          </p>
        </div>

        {d.actions.length > 0 ? (
          <div className="grid gap-px bg-ink/20 md:grid-cols-3">
            {d.actions.map((action) => (
              <article key={action.id} className="flex min-h-64 flex-col justify-between bg-page p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">{action.agent}</span>
                  {action.humanApproved ? <Check size={17} className="text-lime" /> : <ShieldCheck size={17} className="text-coral" />}
                </div>
                <p className="mt-12 text-lg leading-snug tracking-[-0.025em]">{action.reasoning}</p>
                <div className="mt-8 flex items-end justify-between border-t border-ink/15 pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">{action.type.replaceAll("_", " ")}</span>
                  <span className="font-mono text-xs">{action.dollarImpact ? formatCurrency(Math.abs(action.dollarImpact)) : "Prepared"}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-ink/25 p-10 text-center">
            <p className="text-sm text-ink/55">
              No agent activity recorded yet. Open the command center and run an audit.
            </p>
          </div>
        )}

        <div className="mt-12 flex flex-col justify-between gap-6 border-t border-ink/20 pt-6 sm:flex-row sm:items-center">
          <p className="max-w-xl font-display text-2xl leading-tight tracking-[-0.035em]">
            The runway decision is yours. The hard part is already surfaced.
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-3 self-start bg-ink px-5 py-4 text-sm font-medium text-page transition-colors hover:bg-coral sm:self-auto">
            <Bot size={16} />
            Run an audit
          </Link>
        </div>
      </section>

      <section className="border-t border-ink/20 bg-lime">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 px-6 py-12 sm:px-10 md:flex-row md:items-end lg:px-14 lg:py-16">
          <p className="max-w-3xl font-display text-4xl font-medium leading-[0.9] tracking-[-0.055em] sm:text-6xl">
            Less cash leakage. More time to build something that lasts.
          </p>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
            <Bot size={15} /> Runway Radar / 2026
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink/90 px-3 py-3 sm:px-4 sm:py-4">
      <p className="font-mono text-[8px] uppercase tracking-[0.11em] text-page/45">{label}</p>
      <p className="mt-2 text-sm font-medium tracking-[-0.02em] text-page sm:text-base">{value}</p>
    </div>
  );
}

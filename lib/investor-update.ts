/**
 * Investor update — the agent writes its own board slide.
 *
 * Pure read of what the audit already persisted (flags, drafts, snapshots,
 * forecast). No LLM call, no network: the slide is a deterministic function of
 * the action log, so it is the same slide every time in demo mode and it can
 * never be the thing that fails on stage.
 *
 * Consumed by /api/investor-update (JSON) and /investor-update (16:9 page,
 * print-to-PDF). If a Canva connection is ever wired in, this is the payload
 * it should be fed — the content is already shaped like a slide.
 */
import { APPROVAL_THRESHOLD, COMPANY, DEMO_MODE } from "@/lib/company";
import { forecast } from "@/lib/agents/forecast";
import { getActionsForLatestRun, getDrafts, getFlaggedTransactions, getVendors } from "@/lib/db/queries";
import { formatCurrency } from "@/lib/types";
import type { FeatureBreakdown, Flag } from "@/lib/types";

export interface InvestorUpdate {
  company: string;
  period: string;
  generatedAt: string;
  mode: "demo" | "live";
  audited: boolean;
  headline: string;
  kpis: Array<{ label: string; value: string; sub?: string; accent?: "warn" | "good" }>;
  findings: Array<{ vendor: string; kind: string; monthlyCost: string; confidence: string; why: string; action: string }>;
  runway: { scenarios: Array<{ label: string; months: number; netBurn: string }>; monthsGained: number };
  governance: { threshold: string; pending: number; approved: number; sent: number };
  narrative: string[];
}

/** The kind isn't persisted; recover it from the feature names (same rule as /api/state). */
function inferKind(features: FeatureBreakdown[]): Flag["kind"] {
  const names = features.map((f) => f.feature);
  if (names.includes("seat_overlap_vs_headcount")) return "duplicate";
  if (names.includes("period_over_period_growth")) return "price_creep";
  if (names.includes("cost_vs_category_mean")) return "overpriced";
  return "usage_drift";
}

const KIND_LABEL: Record<Flag["kind"], string> = {
  overpriced: "Overpriced vs. category",
  duplicate: "Duplicate tool",
  usage_drift: "Paying for unused seats",
  price_creep: "Silent price creep",
};

const KIND_ACTION: Record<Flag["kind"], string> = {
  overpriced: "Rate renegotiation drafted",
  duplicate: "Cancellation drafted",
  usage_drift: "Tier downgrade drafted",
  price_creep: "Billing review drafted",
};

export function buildInvestorUpdate(): InvestorUpdate {
  const vendors = getVendors();
  const flagged = getFlaggedTransactions();
  const drafts = getDrafts();
  const actions = getActionsForLatestRun();

  const flags: Flag[] = flagged.map((t) => {
    const v = vendors.find((x) => x.id === t.vendorId);
    let features: FeatureBreakdown[] = [];
    try { features = t.features ? JSON.parse(t.features) : []; } catch { features = []; }
    return {
      transactionId: t.id, vendorId: t.vendorId, vendorName: t.vendorName,
      kind: inferKind(features), confidence: t.confidence ?? 0, features,
      headline: t.reason ?? "", monthlyCost: v?.monthlyCost ?? t.amount,
    };
  });

  const f = forecast(flags);
  const [current, cut] = f.scenarios;
  const monthsGained = Math.max(0, Math.round((cut.runwayMonths - current.runwayMonths) * 10) / 10);
  const monthly = f.totalMonthlySavings;
  const annual = monthly * 12;

  // Vendors awaiting a human decision, not raw action rows — a negotiation
  // adds several escalation rows for the same vendor.
  const pending = new Set(actions.filter((a) => a.approvalRequired && !a.humanApproved).map((a) => a.target)).size;
  const approved = drafts.filter((d) => d.approved).length;
  const sent = drafts.filter((d) => d.sent).length;

  const latestPeriod = flagged.map((t) => t.date).sort().at(-1);
  const period = latestPeriod
    ? new Date(latestPeriod + "T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })
    : new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  const audited = actions.length > 0;
  const headline = !audited
    ? "No audit has been run yet."
    : flags.length === 0
      ? "Vendor spend is clean this period. No action required."
      : `${flags.length} spend anomalies found — ${formatCurrency(annual)}/yr recoverable, +${monthsGained} months of runway.`;

  const findings = flags
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .map((fl) => ({
      vendor: fl.vendorName,
      kind: KIND_LABEL[fl.kind],
      monthlyCost: formatCurrency(fl.monthlyCost) + "/mo",
      confidence: `${Math.round(fl.confidence * 100)}%`,
      why: fl.features[0] ? `${fl.features[0].feature.replaceAll("_", " ")}: ${fl.features[0].value}` : fl.headline,
      action: drafts.some((d) => d.vendorId === fl.vendorId) ? KIND_ACTION[fl.kind] : "Flagged, awaiting draft",
    }));

  const narrative = !audited
    ? ["Run an audit from the dashboard to populate this update."]
    : [
        `Runway Radar audited ${vendors.length} vendors (${formatCurrency(f.vendorSpend)}/mo of tooling spend) against ${period} billing data.`,
        flags.length
          ? `It flagged ${flags.length}: ${flags.map((x) => x.vendorName).join(", ")}. Each flag carries a feature-level breakdown of why it fired.`
          : "Nothing exceeded the anomaly thresholds.",
        `${drafts.length} vendor emails were drafted. ${pending} exceeded the ${formatCurrency(APPROVAL_THRESHOLD)}/mo autonomy threshold and are held for a human; ${sent} have been released to the sandbox outbox. Nothing is ever sent to a real vendor without sign-off.`,
        `Acting on all findings moves runway from ${current.runwayMonths.toFixed(1)} to ${cut.runwayMonths.toFixed(1)} months at current revenue (${formatCurrency(COMPANY.mrr)} MRR).`,
      ];

  return {
    company: COMPANY.name,
    period,
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    mode: DEMO_MODE ? "demo" : "live",
    audited,
    headline,
    kpis: [
      { label: "Monthly burn", value: formatCurrency(current.monthlyBurn), sub: `${formatCurrency(f.vendorSpend)} of it is vendors` },
      { label: "Runway today", value: `${current.runwayMonths.toFixed(1)} mo`, sub: `${formatCurrency(COMPANY.cashOnHand)} cash` },
      { label: "Recoverable", value: formatCurrency(annual) + "/yr", sub: `${formatCurrency(monthly)}/mo across ${flags.length} vendors`, accent: "good" },
      { label: "Runway after", value: `${cut.runwayMonths.toFixed(1)} mo`, sub: `+${monthsGained} months`, accent: "good" },
    ],
    findings,
    runway: {
      scenarios: f.scenarios.map((s) => ({ label: s.label, months: Math.round(s.runwayMonths * 10) / 10, netBurn: formatCurrency(s.netBurn) + "/mo" })),
      monthsGained,
    },
    governance: { threshold: formatCurrency(APPROVAL_THRESHOLD) + "/mo", pending, approved, sent },
    narrative,
  };
}

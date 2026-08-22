/**
 * Forecast Agent — burn and runway projection.
 *
 * Pure arithmetic, no LLM. Language models are bad at arithmetic and there is
 * no reason to ask one for a number we can compute exactly.
 *
 * Produces three scenarios plus a Monte Carlo band, because a single runway
 * number implies a precision the underlying assumptions do not support.
 */
import { COMPANY } from "@/lib/company";
import { getTransactions, getVendors } from "@/lib/db/queries";
import type { Flag, Vendor } from "@/lib/types";

export interface Scenario {
  label: string;
  description: string;
  monthlyBurn: number;
  netBurn: number;
  runwayMonths: number;
  /** Cash remaining at the end of each of the next 18 months. */
  path: number[];
}

export interface MonteCarloBand {
  p10: number;
  p50: number;
  p90: number;
  trials: number;
}

export interface ForecastResult {
  vendorSpend: number;
  scenarios: Scenario[];
  monteCarlo: Record<string, MonteCarloBand>;
  /**
   * Historical burn, oldest first. `burn` is everything; `vendorSpend` is the
   * slice Runway Radar can actually act on — payroll swamps it in the total,
   * so the chart needs both lines to tell the story.
   */
  history: Array<{ month: string; burn: number; vendorSpend: number }>;
  totalMonthlySavings: number;
}

const HORIZON = 18;

function makeRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller, for lognormal-ish burn variation. */
function gauss(rng: () => number): number {
  const u = Math.max(rng(), 1e-9), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * What a given flag is worth per month if remediated. These are deliberately
 * conservative — the point is a number you can defend, not the biggest one.
 */
export function estimateSavings(flag: Flag, vendors: Vendor[]): number {
  const v = vendors.find((x) => x.id === flag.vendorId);
  if (!v) return 0;

  switch (flag.kind) {
    case "overpriced": {
      // Target twice the category mean — a premium is defensible, 4x is not.
      const peers = vendors.filter((p) => p.category === v.category && p.id !== v.id);
      if (!peers.length) return 0;
      const peerMean = peers.reduce((s, p) => s + p.monthlyCost, 0) / peers.length;
      return Math.max(0, Math.round(v.monthlyCost - peerMean * 2));
    }
    case "duplicate":
      // Cancel outright; the surviving tool already covers the work.
      return Math.round(v.monthlyCost);
    case "usage_drift": {
      // Tier pricing isn't linear, so don't assume we can drop to bare usage.
      const utilisation = v.seats > 0 ? v.activeSeats / v.seats : 1;
      const floor = Math.max(0.35, utilisation + 0.15);
      return Math.round(v.monthlyCost * (1 - floor));
    }
    case "price_creep": {
      // Roll back to the median of the observed history.
      const amounts = getTransactions()
        .filter((t) => t.vendorId === v.id)
        .map((t) => t.amount)
        .sort((a, b) => a - b);
      if (!amounts.length) return 0;
      const median = amounts[Math.floor(amounts.length / 2)];
      return Math.max(0, Math.round(v.monthlyCost - median));
    }
  }
}

function project(monthlyBurn: number, mrr: number): { runway: number; path: number[] } {
  const net = monthlyBurn - mrr;
  const path: number[] = [];
  let cash: number = COMPANY.cashOnHand;
  for (let m = 0; m < HORIZON; m++) {
    cash = Math.max(0, cash - net);
    path.push(Math.round(cash));
  }
  const runway = net <= 0 ? Infinity : COMPANY.cashOnHand / net;
  return { runway: Math.round(runway * 10) / 10, path };
}

/**
 * 4,000 trials per scenario.
 *
 * Two sources of uncertainty, and the split matters. Month-to-month jitter
 * averages out over a 10-month horizon and produces a uselessly tight band —
 * the real risk is *structural*: a company that is burning 15% hotter than
 * plan is usually still burning hot next month too. So each trial draws a
 * persistent burn multiplier once (sigma 12%) and a persistent MRR growth
 * rate once, then adds smaller monthly noise on top.
 *
 * Runway is interpolated within the final month rather than rounded to a whole
 * month, otherwise the percentiles quantise onto the same integer.
 *
 * Seeded, so the band is identical on every run.
 */
function monteCarlo(monthlyBurn: number, seed: number): MonteCarloBand {
  const rng = makeRng(seed);
  const TRIALS = 4000;
  const runways: number[] = [];

  for (let i = 0; i < TRIALS; i++) {
    // Structural: drawn once per trial and held for the whole projection.
    const burnBias = Math.exp(0.12 * gauss(rng) + 0.015);
    const growthRate = 0.03 + 0.025 * gauss(rng);

    let cash: number = COMPANY.cashOnHand;
    let mrr: number = COMPANY.mrr;
    let months = 0;

    while (months < 120) {
      const burn = monthlyBurn * burnBias * Math.exp(0.04 * gauss(rng));
      mrr *= 1 + growthRate;
      const net = burn - mrr;
      if (net <= 0) { months = 120; break; } // default alive
      if (cash - net <= 0) {
        months += cash / net; // fractional final month
        break;
      }
      cash -= net;
      months += 1;
    }
    runways.push(Math.round(months * 10) / 10);
  }

  runways.sort((a, b) => a - b);
  const at = (q: number) => runways[Math.min(runways.length - 1, Math.floor(q * runways.length))];
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9), trials: TRIALS };
}

export function forecast(flags: Flag[] = []): ForecastResult {
  const vendors = getVendors();
  const txs = getTransactions();

  // Historical burn: vendor spend per period plus the fixed cost base.
  const byMonth = new Map<string, number>();
  for (const t of txs) byMonth.set(t.date, (byMonth.get(t.date) ?? 0) + t.amount);
  const history = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spend]) => ({
      month: new Date(date + "T00:00:00").toLocaleString("en-US", { month: "short" }),
      burn: Math.round(spend + COMPANY.payroll + COMPANY.overhead),
      vendorSpend: Math.round(spend),
    }));

  const vendorSpend = vendors.reduce((s, v) => s + v.monthlyCost, 0);
  const fixed = COMPANY.payroll + COMPANY.overhead;
  const currentBurn = vendorSpend + fixed;

  const totalMonthlySavings = flags.reduce((s, f) => s + estimateSavings(f, vendors), 0);

  const defs = [
    {
      label: "Current",
      description: "No action taken. Every flagged vendor keeps billing as-is.",
      burn: currentBurn,
      seed: 1001,
    },
    {
      label: "Aggressive cut",
      description: `All ${flags.length} flagged vendors remediated: renegotiated, downgraded, or cancelled.`,
      burn: currentBurn - totalMonthlySavings,
      seed: 1002,
    },
    {
      label: "Hiring freeze",
      description: "Flags remediated and the two open roles left unfilled for the projection window.",
      burn: currentBurn - totalMonthlySavings - 13_000,
      seed: 1003,
    },
  ];

  const scenarios: Scenario[] = [];
  const mc: Record<string, MonteCarloBand> = {};
  for (const d of defs) {
    const { runway, path } = project(d.burn, COMPANY.mrr);
    scenarios.push({
      label: d.label,
      description: d.description,
      monthlyBurn: Math.round(d.burn),
      netBurn: Math.round(d.burn - COMPANY.mrr),
      runwayMonths: runway,
      path,
    });
    mc[d.label] = monteCarlo(d.burn, d.seed);
  }

  return { vendorSpend: Math.round(vendorSpend), scenarios, monteCarlo: mc, history, totalMonthlySavings };
}

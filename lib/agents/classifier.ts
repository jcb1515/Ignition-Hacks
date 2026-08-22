/**
 * Classifier Agent — finds wasteful spend in the latest billing period.
 *
 * Detection is fully deterministic. Every flag comes from arithmetic over the
 * transaction history, never from an LLM's opinion, for two reasons: the demo
 * cannot fail on a flaky API, and "why did it flag that?" has an exact answer.
 *
 * Scoring uses a small linear model per detector:
 *
 *     score = sigmoid( bias + Σ wᵢ · (xᵢ − baselineᵢ) )
 *
 * For a linear model the Shapley value of feature i is exactly wᵢ·(xᵢ − baselineᵢ),
 * so the per-feature contributions we report are not an approximation of feature
 * importance — they are the exact decomposition of the score. That is the honest
 * version of the "SHAP-style explainability" in the build plan.
 */
import { COMPANY } from "@/lib/company";
import { getTransactionsForVendor, getVendors, getLatestPeriodTransactions } from "@/lib/db/queries";
import type { FeatureBreakdown, Flag, Vendor } from "@/lib/types";

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Builds the breakdown and the score together so they can never disagree. */
function linearScore(
  bias: number,
  terms: Array<{ feature: string; value: string; weight: number; x: number; baseline: number }>
): { confidence: number; features: FeatureBreakdown[] } {
  let z = bias;
  const features: FeatureBreakdown[] = [];
  for (const t of terms) {
    const contribution = t.weight * (t.x - t.baseline);
    z += contribution;
    features.push({ feature: t.feature, value: t.value, contribution: round(contribution) });
  }
  // Sorted by absolute impact: the first row is the reason it fired.
  features.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return { confidence: round(sigmoid(z)), features };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Least-squares slope of y over evenly spaced x. Used for price creep. */
function slope(ys: number[]): number {
  const n = ys.length;
  if (n < 3) return 0;
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (ys[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/* ------------------------------------------------------------------ */
/* Detector 1: overpriced against category peers                       */
/* ------------------------------------------------------------------ */

function detectOverpriced(vendors: Vendor[]): Flag[] {
  const flags: Flag[] = [];

  for (const v of vendors) {
    const peers = vendors.filter((p) => p.category === v.category && p.id !== v.id);
    if (peers.length < 2) continue; // no defensible norm from one data point

    const peerMean = peers.reduce((s, p) => s + p.monthlyCost, 0) / peers.length;
    if (peerMean <= 0) continue;
    const ratio = v.monthlyCost / peerMean;
    if (ratio < 1.8) continue;

    // Utilisation is a mitigating factor: heavy use can justify a premium.
    const utilisation = v.seats > 0 ? v.activeSeats / v.seats : 1;

    const { confidence, features } = linearScore(-2.2, [
      {
        feature: "cost_vs_category_mean",
        value: `${ratio.toFixed(2)}x peer mean ($${Math.round(peerMean).toLocaleString()})`,
        weight: 1.9, x: ratio, baseline: 1.0,
      },
      {
        feature: "seat_utilisation",
        value: `${Math.round(utilisation * 100)}% of seats active`,
        weight: -1.4, x: utilisation, baseline: 0.85,
      },
      {
        feature: "months_since_contact",
        value: monthsSince(v.lastContactDate) + " months since last vendor contact",
        weight: 0.12, x: monthsSince(v.lastContactDate), baseline: 3,
      },
    ]);

    if (confidence < 0.6) continue;
    flags.push({
      transactionId: "", vendorId: v.id, vendorName: v.name,
      kind: "overpriced", confidence, features,
      monthlyCost: v.monthlyCost,
      headline: `${v.name} costs ${ratio.toFixed(1)}x the ${v.category.toLowerCase()} category mean with no usage justification.`,
    });
  }
  return flags;
}

/* ------------------------------------------------------------------ */
/* Detector 2: duplicate tooling                                       */
/* ------------------------------------------------------------------ */

/**
 * Two vendors are substitutes only when they share a function tag — a wiki and
 * an issue tracker are both "Productivity" but nobody cancels one to keep the
 * other. Within a function, combined active seats exceeding headcount means
 * people are provisioned on both tools, and the lower-utilisation one is the
 * one to cut.
 */
function detectDuplicates(vendors: Vendor[]): Flag[] {
  const flags: Flag[] = [];
  const byFunction = new Map<string, Vendor[]>();
  for (const v of vendors) {
    if (v.seats === 0) continue; // infrastructure has no seats; skip
    byFunction.set(v.functionTag, [...(byFunction.get(v.functionTag) ?? []), v]);
  }

  for (const [, group] of byFunction) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        // Imported data often knows provisioned seats but not active ones.
        // Provisioned is the honest upper bound; say so in the evidence.
        const activeA = a.activeSeats > 0 ? a.activeSeats : a.seats;
        const activeB = b.activeSeats > 0 ? b.activeSeats : b.seats;
        const assumed = a.activeSeats === 0 || b.activeSeats === 0;
        const combined = activeA + activeB;
        const overlapRatio = combined / COMPANY.headcount;
        if (overlapRatio <= 1.0) continue; // no double-provisioning

        // Flag the weaker of the pair.
        const utilA = activeA / a.seats;
        const utilB = activeB / b.seats;
        // Equal utilisation: flag the pricier one, otherwise the emptier one.
        const weak = utilA < utilB ? a : utilB < utilA ? b : a.monthlyCost >= b.monthlyCost ? a : b;
        const strong = weak === a ? b : a;
        const weakUtil = (weak === a ? activeA : activeB) / weak.seats;
        const strongUtil = (strong === a ? activeA : activeB) / strong.seats;

        const { confidence, features } = linearScore(-1.6, [
          {
            feature: "seat_overlap_vs_headcount",
            value: `${combined} ${assumed ? "provisioned" : "active"} seats across both for ${COMPANY.headcount} employees`,
            weight: 2.6, x: overlapRatio, baseline: 1.0,
          },
          {
            feature: "utilisation_gap",
            value: `${weak.name} at ${Math.round(weakUtil * 100)}% vs ${strong.name} at ${Math.round(strongUtil * 100)}%`,
            weight: 2.2, x: strongUtil - weakUtil, baseline: 0,
          },
          {
            feature: "same_function",
            value: `both serve as ${weak.functionTag.replaceAll("_", " ")}`,
            weight: 0.8, x: 1, baseline: 0,
          },
        ]);

        if (confidence < 0.6) continue;
        flags.push({
          transactionId: "", vendorId: weak.id, vendorName: weak.name,
          kind: "duplicate", confidence, features,
          monthlyCost: weak.monthlyCost,
          headline: `${weak.name} duplicates ${strong.name}; ${combined} seats provisioned across both for ${COMPANY.headcount} people.`,
        });
      }
    }
  }
  return flags;
}

/* ------------------------------------------------------------------ */
/* Detector 3: usage drift — paying for capacity nobody uses           */
/* ------------------------------------------------------------------ */

function detectUsageDrift(vendors: Vendor[]): Flag[] {
  const flags: Flag[] = [];
  for (const v of vendors) {
    if (v.seats < 5) continue;
    // Zero active seats means "unknown" (bank exports and uploads rarely carry
    // usage), not "nobody uses it". Without a real utilisation figure there is
    // no drift to detect.
    if (v.activeSeats === 0) continue;
    const utilisation = v.activeSeats / v.seats;
    if (utilisation > 0.4) continue;

    const wastedSeats = v.seats - v.activeSeats;
    const costPerActiveSeat = v.monthlyCost / Math.max(1, v.activeSeats);

    const { confidence, features } = linearScore(-1.0, [
      {
        feature: "seat_utilisation",
        value: `${v.activeSeats}/${v.seats} seats active (${Math.round(utilisation * 100)}%)`,
        weight: -4.5, x: utilisation, baseline: 0.65,
      },
      {
        feature: "cost_per_active_seat",
        value: `$${Math.round(costPerActiveSeat).toLocaleString()} per active seat/mo`,
        weight: 0.004, x: costPerActiveSeat, baseline: 120,
      },
      {
        feature: "unused_capacity",
        value: `${wastedSeats} provisioned seats unused`,
        weight: 0.03, x: wastedSeats, baseline: 2,
      },
    ]);

    if (confidence < 0.6) continue;
    flags.push({
      transactionId: "", vendorId: v.id, vendorName: v.name,
      kind: "usage_drift", confidence, features,
      monthlyCost: v.monthlyCost,
      headline: `${v.name} is provisioned for ${v.seats} seats but only ${v.activeSeats} are active — the tier was sized for growth that did not arrive.`,
    });
  }
  return flags;
}

/* ------------------------------------------------------------------ */
/* Detector 4: price creep across billing periods                      */
/* ------------------------------------------------------------------ */

function detectPriceCreep(vendors: Vendor[]): Flag[] {
  const flags: Flag[] = [];
  for (const v of vendors) {
    const history = getTransactionsForVendor(v.id).map((t) => t.amount);
    if (history.length < 4) continue;

    const first = history[0];
    const last = history[history.length - 1];
    if (first <= 0) continue;

    const growth = last / first - 1;
    if (growth < 0.35) continue;

    // Monotonic climbs are contract creep; spiky ones are usage.
    const monthlySlope = slope(history);
    let monotoneSteps = 0;
    for (let i = 1; i < history.length; i++) if (history[i] > history[i - 1]) monotoneSteps++;
    const monotonicity = monotoneSteps / (history.length - 1);

    const { confidence, features } = linearScore(-2.4, [
      {
        feature: "period_over_period_growth",
        value: `+${Math.round(growth * 100)}% across ${history.length} periods ($${first.toLocaleString()} to $${last.toLocaleString()})`,
        weight: 3.4, x: growth, baseline: 0.05,
      },
      {
        feature: "monotonicity",
        value: `${monotoneSteps}/${history.length - 1} periods increased`,
        weight: 2.0, x: monotonicity, baseline: 0.5,
      },
      {
        feature: "avg_monthly_increase",
        value: `$${Math.round(monthlySlope).toLocaleString()}/mo trend`,
        weight: 0.0025, x: monthlySlope, baseline: 40,
      },
    ]);

    if (confidence < 0.6) continue;
    flags.push({
      transactionId: "", vendorId: v.id, vendorName: v.name,
      kind: "price_creep", confidence, features,
      monthlyCost: v.monthlyCost,
      headline: `${v.name} climbed ${Math.round(growth * 100)}% over ${history.length} periods with no plan change on record.`,
    });
  }
  return flags;
}

/* ------------------------------------------------------------------ */
/* Detector 5: billing spike — one period far above the vendor's norm   */
/* ------------------------------------------------------------------ */

/**
 * A single invoice at 2x+ the vendor's median is an overage, a double bill or
 * a mis-tiered month — the kind of thing nobody notices until the quarter
 * closes. Unlike price creep this is about one period, not a trend, so the
 * remedy is a credit request rather than a rate change.
 */
function detectBillingSpikes(vendors: Vendor[]): Flag[] {
  const flags: Flag[] = [];
  for (const v of vendors) {
    const txs = getTransactionsForVendor(v.id);
    if (txs.length < 4) continue;
    const amounts = txs.map((t) => t.amount);
    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= 0) continue;

    let peakIdx = 0;
    for (let i = 1; i < amounts.length; i++) if (amounts[i] > amounts[peakIdx]) peakIdx = i;
    const peak = amounts[peakIdx];
    const ratio = peak / median;
    if (ratio < 2.0) continue;

    // A peak that is also the start of a sustained climb is price creep's job.
    const after = amounts.slice(peakIdx + 1);
    const reverted = after.length === 0 || after.every((a) => a < peak * 0.75);
    if (!reverted) continue;

    const excess = peak - median;
    const periodsAgo = amounts.length - 1 - peakIdx;

    const { confidence, features } = linearScore(-1.8, [
      {
        feature: "spike_vs_median",
        value: `${ratio.toFixed(1)}x the vendor's median ($${Math.round(peak).toLocaleString()} vs $${Math.round(median).toLocaleString()})`,
        weight: 1.6, x: ratio, baseline: 1.0,
      },
      {
        feature: "excess_dollars",
        value: `$${Math.round(excess).toLocaleString()} above the normal invoice`,
        weight: 0.0006, x: excess, baseline: 200,
      },
      {
        feature: "reverted_after",
        value: periodsAgo === 0 ? "the spike is the latest period" : `back to normal for ${periodsAgo} ${periodsAgo === 1 ? "period" : "periods"} since`,
        weight: 0.6, x: reverted ? 1 : 0, baseline: 0,
      },
    ]);

    if (confidence < 0.6) continue;
    flags.push({
      transactionId: txs[peakIdx].id, vendorId: v.id, vendorName: v.name,
      kind: "billing_spike", confidence, features,
      monthlyCost: v.monthlyCost,
      headline: `${v.name} billed $${Math.round(peak).toLocaleString()} in ${txs[peakIdx].date.slice(0, 7)}, ${ratio.toFixed(1)}x its usual $${Math.round(median).toLocaleString()} — a one-off overage worth querying.`,
    });
  }
  return flags;
}

const monthsSince = (iso: string) => {
  const then = new Date(iso).getTime();
  const now = new Date("2026-01-21").getTime();
  return Math.max(0, Math.round((now - then) / (1000 * 60 * 60 * 24 * 30.44)));
};

/* ------------------------------------------------------------------ */

/**
 * Runs all five detectors. Four look at the latest billing period; the
 * billing-spike detector scans the history.
 * One flag per vendor: if several detectors fire, the most confident wins.
 */
export function classify(): Flag[] {
  const vendors = getVendors();
  // Each flag is written onto a transaction row. Prefer the latest billing
  // period; fall back to the vendor's most recent charge, because uploaded
  // data is rarely aligned to the same month for every vendor.
  const latest = getLatestPeriodTransactions();
  const txByVendor = new Map(latest.map((t) => [t.vendorId, t.id]));
  for (const v of vendors) {
    if (txByVendor.has(v.id)) continue;
    const last = getTransactionsForVendor(v.id).at(-1);
    if (last) txByVendor.set(v.id, last.id);
  }

  const all = [
    ...detectOverpriced(vendors),
    ...detectDuplicates(vendors),
    ...detectUsageDrift(vendors),
    ...detectPriceCreep(vendors),
    ...detectBillingSpikes(vendors),
  ];

  const best = new Map<string, Flag>();
  for (const f of all) {
    const existing = best.get(f.vendorId);
    if (!existing || f.confidence > existing.confidence) {
      best.set(f.vendorId, { ...f, transactionId: f.transactionId || (txByVendor.get(f.vendorId) ?? "") });
    }
  }

  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}

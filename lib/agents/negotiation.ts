/**
 * Negotiation loop — the Negotiator actually negotiates.
 *
 * The audit produces one outbound ask per flag. This runs the rest of the
 * conversation: ask → vendor counter → evaluate → counter or accept or
 * escalate. The policy is explicit and small:
 *
 *   target      = vendor cost − estimated savings (from the Forecast agent)
 *   acceptable  = target × (1 + TOLERANCE)
 *   accept      if the vendor's offer ≤ acceptable
 *   counter     otherwise, asking for the midpoint between target and offer
 *   escalate    if the vendor says "final" and is still above acceptable —
 *               a human decides whether to take the best offer or walk
 *
 * The approval gate applies to *commitments*, not just emails: accepting a deal
 * whose monthly impact exceeds APPROVAL_THRESHOLD is written as pending, not
 * done. The agent can haggle on its own; it cannot sign on its own.
 *
 * Every turn is an agent_actions row, so the thread is reconstructable from
 * the log and visible on the dashboard. No schema change.
 */
import { randomUUID } from "node:crypto";
import { APPROVAL_THRESHOLD, AUDIT_PACE_MS } from "@/lib/company";
import { estimateSavings } from "@/lib/agents/forecast";
import { vendorReply } from "@/lib/agents/counterparty";
import { getActions, getFlaggedTransactions, getVendor, getVendors, insertAction, setVendorStatus } from "@/lib/db/queries";
import { formatCurrency } from "@/lib/types";
import type { AgentAction, FeatureBreakdown, Flag } from "@/lib/types";

export const MAX_ROUNDS = 3;
/** Accept anything within this fraction above target. */
export const TOLERANCE = 0.08;

export type Outcome = "accepted" | "pending_approval" | "escalated" | "no_flag";

export interface NegotiationSummary {
  vendorId: string;
  vendorName: string;
  kind: Flag["kind"] | null;
  rounds: number;
  outcome: Outcome;
  startMonthly: number;
  targetMonthly: number;
  bestOfferMonthly: number;
  realisedMonthlySavings: number;
  realisedAnnualSavings: number;
}

export type NegotiationEvent =
  | { type: "status"; message: string }
  | { type: "action"; action: AgentAction }
  | { type: "done"; summary: NegotiationSummary };

function pace(): Promise<void> {
  return AUDIT_PACE_MS > 0 ? new Promise((r) => setTimeout(r, AUDIT_PACE_MS)) : Promise.resolve();
}
const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);

function inferKind(features: FeatureBreakdown[]): Flag["kind"] {
  const names = features.map((f) => f.feature);
  if (names.includes("seat_overlap_vs_headcount")) return "duplicate";
  if (names.includes("period_over_period_growth")) return "price_creep";
  if (names.includes("spike_vs_median")) return "billing_spike";
  if (names.includes("cost_vs_category_mean")) return "overpriced";
  return "usage_drift";
}

/** The flag the audit wrote for this vendor, rebuilt from the transaction row. */
export function flagForVendor(vendorId: string): Flag | undefined {
  const t = getFlaggedTransactions().find((x) => x.vendorId === vendorId);
  if (!t) return undefined;
  const v = getVendor(vendorId);
  let features: FeatureBreakdown[] = [];
  try { features = t.features ? JSON.parse(t.features) : []; } catch { features = []; }
  return {
    transactionId: t.id, vendorId, vendorName: t.vendorName, kind: inferKind(features),
    confidence: t.confidence ?? 0, features, headline: t.reason ?? "", monthlyCost: v?.monthlyCost ?? t.amount,
  };
}

function record(
  type: string, target: string, reasoning: string,
  opts: { dollarImpact?: number; approvalRequired?: boolean; humanApproved?: boolean } = {}
): AgentAction {
  const a: AgentAction = {
    id: randomUUID(), timestamp: now(), agent: "Negotiator", type, target, reasoning,
    humanApproved: opts.humanApproved ?? false, approvalRequired: opts.approvalRequired ?? false,
    dollarImpact: opts.dollarImpact ?? 0,
  };
  insertAction(a);
  return a;
}

/** Actions that make up one vendor's negotiation thread, oldest first. */
export function negotiationThread(vendorName: string): AgentAction[] {
  return getActions(1000)
    .filter((a) => a.target === vendorName && (a.type.startsWith("negotiation_") || a.type.startsWith("vendor_")))
    .reverse();
}

export async function* runNegotiation(vendorId: string): AsyncGenerator<NegotiationEvent> {
  const vendor = getVendor(vendorId);
  const flag = flagForVendor(vendorId);
  if (!vendor || !flag) {
    yield { type: "done", summary: {
      vendorId, vendorName: vendor?.name ?? vendorId, kind: null, rounds: 0, outcome: "no_flag",
      startMonthly: vendor?.monthlyCost ?? 0, targetMonthly: 0, bestOfferMonthly: 0,
      realisedMonthlySavings: 0, realisedAnnualSavings: 0,
    } };
    return;
  }

  const allVendors = getVendors();
  const start = vendor.monthlyCost;
  const targetSavings = estimateSavings(flag, allVendors);
  const target = Math.max(0, start - targetSavings);
  const acceptable = Math.round(target * (1 + TOLERANCE));

  yield { type: "status", message: `Negotiator opening talks with ${vendor.name}...` };
  yield { type: "action", action: record(
    "negotiation_opened", vendor.name,
    `Opening negotiation with ${vendor.name}. Current ${formatCurrency(start)}/mo. Target ${formatCurrency(target)}/mo (from the Forecast agent's ${formatCurrency(targetSavings)}/mo estimate); I'll accept anything up to ${formatCurrency(acceptable)}/mo, counter above that, and escalate to a human if the vendor's final offer is still above it. Max ${MAX_ROUNDS} rounds.`,
  ) };

  let ask = target;
  let bestOffer = start;
  let outcome: Outcome = "escalated";
  let rounds = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    rounds = round;
    await pace();
    yield { type: "status", message: `Round ${round}: asking ${vendor.name} for ${formatCurrency(ask)}/mo...` };
    yield { type: "action", action: record(
      "negotiation_round", vendor.name,
      flag.kind === "duplicate"
        ? (round === 1 ? `Round ${round} — sent the cancellation request.` : `Round ${round} — declined the retention offer; the consolidation decision stands. Reiterated the cancellation.`)
        : round === 1
          ? `Round ${round} — sent the ask for ${formatCurrency(ask)}/mo.`
          : `Round ${round} — countered at ${formatCurrency(ask)}/mo, the midpoint between my target and their last offer.`,
      { dollarImpact: start - ask },
    ) };

    await pace();
    const reply = vendorReply(flag, vendor, ask, round);
    bestOffer = Math.min(bestOffer, reply.offerMonthly);
    yield { type: "action", action: record(
      `vendor_${reply.stance}`, vendor.name,
      `[${vendor.name} replies] ${reply.message}`,
      { dollarImpact: start - reply.offerMonthly },
    ) };

    await pace();
    const savings = start - reply.offerMonthly;

    if (reply.stance === "accept" || reply.offerMonthly <= acceptable) {
      const needsHuman = savings > APPROVAL_THRESHOLD;
      outcome = needsHuman ? "pending_approval" : "accepted";
      yield { type: "action", action: record(
        needsHuman ? "negotiation_accept_pending" : "negotiation_accepted", vendor.name,
        needsHuman
          ? `Their offer of ${formatCurrency(reply.offerMonthly)}/mo meets my acceptable ceiling (${formatCurrency(acceptable)}/mo). Saves ${formatCurrency(savings)}/mo — above the ${formatCurrency(APPROVAL_THRESHOLD)}/mo autonomy threshold, so I'm recommending acceptance but not committing. A human signs this one.`
          : `Accepting ${formatCurrency(reply.offerMonthly)}/mo — within my acceptable ceiling (${formatCurrency(acceptable)}/mo) and saves ${formatCurrency(savings)}/mo, under the ${formatCurrency(APPROVAL_THRESHOLD)}/mo threshold, so I'm closing it myself.`,
        { dollarImpact: savings, approvalRequired: needsHuman, humanApproved: !needsHuman },
      ) };
      if (!needsHuman && flag.kind === "duplicate") setVendorStatus(vendor.id, "cancelled");
      break;
    }

    if (reply.stance === "final" || round === MAX_ROUNDS) {
      outcome = "escalated";
      yield { type: "action", action: record(
        "negotiation_escalated", vendor.name,
        `${vendor.name}'s best offer is ${formatCurrency(bestOffer)}/mo (saves ${formatCurrency(start - bestOffer)}/mo), above my ceiling of ${formatCurrency(acceptable)}/mo. I've stopped negotiating. A human should decide: take ${formatCurrency(start - bestOffer)}/mo now, or walk and switch vendors.`,
        { dollarImpact: start - bestOffer, approvalRequired: true },
      ) };
      break;
    }

    // Counter: split the difference between what I want and what they offered.
    ask = flag.kind === "duplicate" ? 0 : Math.round((target + reply.offerMonthly) / 2);
    yield { type: "action", action: record(
      "negotiation_evaluate", vendor.name,
      flag.kind === "duplicate"
        ? `A ${formatCurrency(reply.offerMonthly)}/mo retention discount doesn't change the decision — we already pay for a tool that does this job. Declining and reiterating the cancellation.`
        : `${formatCurrency(reply.offerMonthly)}/mo is above my ceiling of ${formatCurrency(acceptable)}/mo. They haven't said final, so I'll counter at ${formatCurrency(ask)}/mo.`,
    ) };
  }

  const realised = outcome === "accepted" ? start - bestOffer : 0;
  yield { type: "done", summary: {
    vendorId: vendor.id, vendorName: vendor.name, kind: flag.kind, rounds, outcome,
    startMonthly: start, targetMonthly: target, bestOfferMonthly: bestOffer,
    realisedMonthlySavings: realised, realisedAnnualSavings: realised * 12,
  } };
}

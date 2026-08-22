/**
 * Counterparty — a simulated vendor the Negotiator can actually negotiate with.
 *
 * One email is an ask. A negotiation is a loop: ask, counter, evaluate, counter
 * again, accept or walk. This module plays the vendor side so the loop has
 * something to push against. Replies are deterministic, keyed on what kind of
 * problem was flagged and which round we are in, so the demo converges the same
 * way every time and the smoke test can assert the outcome.
 *
 * Nothing here talks to a real vendor. In a live deployment this is where an
 * inbound-email parser would sit; the Negotiator's policy above it would not change.
 */
import type { Flag, Vendor } from "@/lib/types";
import { formatCurrency } from "@/lib/types";

export type Stance = "counter" | "final" | "accept" | "retention";

export interface VendorReply {
  /** What the vendor proposes to charge per month after this reply. */
  offerMonthly: number;
  stance: Stance;
  message: string;
}

const r2 = (n: number) => Math.round(n);

/**
 * @param ask   what the Negotiator just asked for, in $/mo
 * @param round 1-based round number
 */
export function vendorReply(flag: Flag, vendor: Vendor, ask: number, round: number): VendorReply {
  const cost = vendor.monthlyCost;
  const name = vendor.name;

  switch (flag.kind) {
    case "overpriced": {
      // Opens low, improves once, then plants a flag at 25% off.
      if (round === 1) {
        const offer = r2(cost * 0.9);
        return { offerMonthly: offer, stance: "counter", message:
          `Thanks for the note. ${formatCurrency(ask)}/mo isn't something we can do on your current plan, but we can apply a 10% loyalty adjustment, bringing you to ${formatCurrency(offer)}/mo effective next cycle.` };
      }
      if (round === 2) {
        const offer = r2(cost * 0.78);
        return { offerMonthly: offer, stance: "counter", message:
          `Understood that you're evaluating alternatives. With an annual commitment we can go to ${formatCurrency(offer)}/mo — that's 22% below where you are today.` };
      }
      const offer = r2(cost * 0.75);
      return { offerMonthly: offer, stance: "final", message:
        `${formatCurrency(offer)}/mo on a 12-month term is the best I can get approved. I'd need to loop in our VP for anything lower, and honestly I don't expect it to move.` };
    }

    case "duplicate": {
      // Tries one retention offer, then processes the cancellation.
      if (round === 1) {
        const offer = r2(cost * 0.85);
        return { offerMonthly: offer, stance: "retention", message:
          `Sorry to hear you're consolidating. Before we process this — would a 15% reduction (${formatCurrency(offer)}/mo) and a 30-minute workflow review change the picture? If not, we'll honour the cancellation.` };
      }
      return { offerMonthly: 0, stance: "accept", message:
        `Noted. We've scheduled the cancellation of your ${name} subscription for the end of the current term. Data export is available under Settings → Export for 90 days after that date. Final invoice will reflect the remaining period only.` };
    }

    case "usage_drift": {
      // First offers a mid tier, then one sized to actual seats.
      const util = vendor.seats > 0 ? vendor.activeSeats / vendor.seats : 1;
      if (round === 1) {
        const offer = r2(cost * 0.7);
        return { offerMonthly: offer, stance: "counter", message:
          `We can move you to our Team tier at ${formatCurrency(offer)}/mo, effective next billing cycle rather than at renewal. It keeps your integrations intact.` };
      }
      const offer = r2(cost * Math.min(0.6, util + 0.2));
      return { offerMonthly: offer, stance: "final", message:
        `Looking at your actual usage (${vendor.activeSeats} active of ${vendor.seats} provisioned), the right fit is a ${vendor.activeSeats + 2}-seat plan at ${formatCurrency(offer)}/mo. That's the floor for your feature set — below that you'd lose SSO and audit logs.` };
    }

    case "price_creep": {
      // Offers a freeze, then a partial rollback, then a final rollback.
      if (round === 1) {
        return { offerMonthly: cost, stance: "counter", message:
          `The increase reflects usage-based metering on your account. We can freeze your rate at ${formatCurrency(cost)}/mo for the next 12 months so it doesn't climb further, and send the itemised breakdown you asked for.` };
      }
      if (round === 2) {
        const offer = r2((cost + ask) / 2);
        return { offerMonthly: offer, stance: "counter", message:
          `Having reviewed the breakdown, part of the growth was a default retention setting nobody changed. We can bring you to ${formatCurrency(offer)}/mo on a committed-use plan.` };
      }
      const offer = r2(ask * 1.05);
      return { offerMonthly: offer, stance: "final", message:
        `Final position: ${formatCurrency(offer)}/mo with the retention setting corrected and a 12-month commit. That's within 5% of what you asked for and as far as I can go.` };
    }
  }
}

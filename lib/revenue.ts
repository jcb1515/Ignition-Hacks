/**
 * Where MRR comes from.
 *
 * The seeded company carries a fixed MRR (lib/company.ts) so demo mode is
 * deterministic. When DEMO_MODE=false and a Stripe test-mode key is set, the
 * sync stores the real pull here and every consumer — forecast, dashboard,
 * investor update, Ask — reads it through currentMrr() instead of the constant.
 */
import { COMPANY } from "@/lib/company";
import { getSetting, setSetting } from "@/lib/db/queries";
import type { StripeRevenue } from "@/lib/integrations/stripe";

const KEY = "stripe_revenue";

export interface RevenueProfile {
  /** Monthly recurring revenue used by the forecast. */
  mrr: number;
  source: "stripe" | "seed";
  activeSubscriptions: number;
  subscriptions: StripeRevenue["subscriptions"];
  /** ISO timestamp of the Stripe pull, absent for seeded MRR. */
  syncedAt?: string;
}

export function storeStripeRevenue(r: StripeRevenue): void {
  setSetting(KEY, JSON.stringify({ ...r, syncedAt: new Date().toISOString() }));
}

export function revenueProfile(): RevenueProfile {
  const raw = getSetting(KEY);
  if (raw) {
    try {
      const r = JSON.parse(raw) as StripeRevenue & { syncedAt?: string };
      if (typeof r.mrr === "number" && Number.isFinite(r.mrr)) {
        return {
          mrr: r.mrr,
          source: "stripe",
          activeSubscriptions: r.activeSubscriptions ?? 0,
          subscriptions: r.subscriptions ?? [],
          syncedAt: r.syncedAt,
        };
      }
    } catch {
      /* fall through to the seeded value */
    }
  }
  return { mrr: COMPANY.mrr, source: "seed", activeSubscriptions: 0, subscriptions: [] };
}

export function currentMrr(): number {
  return revenueProfile().mrr;
}

import { NextResponse } from "next/server";
import { APPROVAL_THRESHOLD, COMPANY, DEMO_MODE } from "@/lib/company";
import { llmAvailable } from "@/lib/llm";
import { estimateSavings, forecast } from "@/lib/agents/forecast";
import {
  getActions, getDrafts, getFlaggedTransactions,
  getLatestPeriodTransactions, getVendors,
} from "@/lib/db/queries";
import type { FeatureBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Everything the dashboard renders, in one round trip. */
export async function GET() {
  try {
    const vendors = getVendors();
    const transactions = getLatestPeriodTransactions();
    const flagged = getFlaggedTransactions();
    const actions = getActions(60);
    const drafts = getDrafts();

    // Rebuild flags from what the Classifier persisted, so the forecast on
    // this page always matches the audit that produced it.
    const rebuilt = flagged.map((t) => {
      const v = vendors.find((x) => x.id === t.vendorId);
      let features: FeatureBreakdown[] = [];
      try {
        features = t.features ? JSON.parse(t.features) : [];
      } catch {
        features = [];
      }
      return {
        transactionId: t.id,
        vendorId: t.vendorId,
        vendorName: t.vendorName,
        kind: inferKind(features),
        confidence: t.confidence ?? 0,
        features,
        headline: t.reason ?? "",
        monthlyCost: v?.monthlyCost ?? t.amount,
      };
    });

    // Remediation value per flag. The approval queue needs this to decide what
    // sits above the autonomy threshold, and without it every draft reads as
    // $0 and nothing is ever held for a human.
    const flags = rebuilt.map((f) => ({ ...f, savings: estimateSavings(f, vendors) }));

    const fc = forecast(flags);

    return NextResponse.json({
      company: COMPANY,
      config: {
        demoMode: DEMO_MODE,
        llmLive: llmAvailable(),
        approvalThreshold: APPROVAL_THRESHOLD,
      },
      vendors,
      transactions,
      flags,
      actions,
      drafts,
      forecast: fc,
      audited: actions.length > 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load state" },
      { status: 500 }
    );
  }
}

/** The kind isn't stored separately; recover it from the feature names. */
function inferKind(features: FeatureBreakdown[]) {
  const names = features.map((f) => f.feature);
  if (names.includes("seat_overlap_vs_headcount")) return "duplicate" as const;
  if (names.includes("period_over_period_growth")) return "price_creep" as const;
  if (names.includes("cost_vs_category_mean")) return "overpriced" as const;
  return "usage_drift" as const;
}

import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/company";
import { plaidConfigured } from "@/lib/integrations/plaid";
import { stripeConfigured } from "@/lib/integrations/stripe";
import { runLiveSync } from "@/lib/integrations/sync";

export const dynamic = "force-dynamic";

/** What the dashboard needs to label the data source honestly. */
export async function GET() {
  return NextResponse.json({
    mode: DEMO_MODE ? "demo" : "live",
    plaid: plaidConfigured(),
    stripe: stripeConfigured(),
  });
}

/**
 * Pulls Plaid sandbox spend + Stripe test revenue into the database.
 * Returns 409 in demo mode rather than silently doing nothing, so a
 * mis-set flag is visible instead of mysterious.
 */
export async function POST() {
  if (DEMO_MODE) {
    return NextResponse.json(
      { error: "DEMO_MODE is on; set DEMO_MODE=false to sync live sandbox data." },
      { status: 409 }
    );
  }
  if (!plaidConfigured() && !stripeConfigured()) {
    return NextResponse.json(
      { error: "No PLAID_CLIENT_ID/PLAID_SECRET or STRIPE_SECRET_KEY (sk_test_) configured." },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await runLiveSync());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 }
    );
  }
}

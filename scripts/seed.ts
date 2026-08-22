/**
 * Seeds six months of vendor spend for Northwind Labs.
 *
 * Four anomalies are planted as INPUTS, not answers: no transaction is written
 * with `flagged`, `reason`, or `confidence` set. The Classifier Agent has to
 * find them from the raw numbers. If you pre-flag them here you are testing
 * nothing and the demo is a lie.
 *
 *   1. Twilio        — overpriced vs. Communication category norm
 *   2. Confluence    — duplicate of Notion; combined seats exceed headcount
 *   3. Segment       — cost flat while active usage collapsed
 *   4. Datadog       — price crept up ~80% over six months, no plan change
 *
 * Noise is generated from a fixed-seed PRNG so every reseed produces byte-identical
 * data. Deterministic demos do not surprise you in front of a judge.
 */
import { resetDb } from "../lib/db";
import { insertTransaction, insertVendor } from "../lib/db/queries";
import type { Source, Transaction, Vendor } from "../lib/types";

/** mulberry32 — small, fast, fully deterministic. */
function makeRng(seed: number) {
  let a = seed;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260121);

/** Billing periods, oldest first. Six months ending Jan 2026. */
const PERIODS = [
  "2025-08-01", "2025-09-01", "2025-10-01",
  "2025-11-01", "2025-12-01", "2026-01-01",
];

interface SeedVendor extends Omit<Vendor, "id"> {
  id: string;
  source: Source;
  /** Per-period multipliers against monthlyCost. Length must equal PERIODS. */
  trend: number[];
}

const flat = [1, 1, 1, 1, 1, 1];

const SEED_VENDORS: SeedVendor[] = [
  {
    // ANOMALY 1: 4x the Communication category norm. No usage spike to justify it.
    id: "v_twilio", name: "Twilio", category: "Communication",
    monthlyCost: 6400, contractTerms: "Annual, paid monthly",
    lastContactDate: "2025-02-12", contactEmail: "billing@twilio.com",
    status: "safe", seats: 12, activeSeats: 11, source: "Plaid", trend: flat, functionTag: "programmable_messaging",
  },
  {
    id: "v_slack", name: "Slack", category: "Communication",
    monthlyCost: 2400, contractTerms: "Annual", lastContactDate: "2025-08-15",
    contactEmail: "billing@slack.com", status: "safe", functionTag: "team_chat",
    seats: 12, activeSeats: 12, source: "Plaid", trend: flat,
  },
  {
    id: "v_zoom", name: "Zoom", category: "Communication",
    monthlyCost: 800, contractTerms: "Monthly", lastContactDate: "2025-11-02",
    contactEmail: "billing@zoom.us", status: "safe", functionTag: "video_conferencing",
    seats: 12, activeSeats: 9, source: "Plaid", trend: flat,
  },
  {
    // ANOMALY 2a: pairs with Confluence. Notion is the one that's actually used.
    id: "v_notion", name: "Notion", category: "Productivity",
    monthlyCost: 480, contractTerms: "Monthly", lastContactDate: "2026-01-05",
    contactEmail: "support@notion.so", status: "safe", functionTag: "knowledge_base",
    seats: 14, activeSeats: 12, source: "Plaid", trend: flat,
  },
  {
    // ANOMALY 2b: same job as Notion, barely used, still fully provisioned.
    id: "v_confluence", name: "Confluence", category: "Productivity",
    monthlyCost: 420, contractTerms: "Monthly", lastContactDate: "2025-03-20",
    contactEmail: "support@atlassian.com", status: "safe", functionTag: "knowledge_base",
    seats: 12, activeSeats: 4, source: "Plaid", trend: flat,
  },
  {
    id: "v_linear", name: "Linear", category: "Productivity",
    monthlyCost: 192, contractTerms: "Monthly", lastContactDate: "2026-01-12",
    contactEmail: "support@linear.app", status: "safe", functionTag: "issue_tracking",
    seats: 12, activeSeats: 12, source: "Stripe", trend: flat,
  },
  {
    // ANOMALY 3: enterprise tier bought at a growth assumption that never landed.
    id: "v_segment", name: "Segment", category: "Analytics",
    monthlyCost: 3200, contractTerms: "Monthly", lastContactDate: "2025-04-10",
    contactEmail: "billing@segment.com", status: "safe", functionTag: "customer_data_platform",
    seats: 50, activeSeats: 6, source: "Stripe", trend: flat,
  },
  {
    // ANOMALY 4: no plan change, bill climbed 79% across six periods.
    id: "v_datadog", name: "Datadog", category: "Infrastructure",
    monthlyCost: 3400, contractTerms: "Usage-based, monthly",
    lastContactDate: "2025-06-30", contactEmail: "billing@datadoghq.com",
    status: "safe", seats: 12, activeSeats: 10, source: "Plaid", functionTag: "observability",
    trend: [0.559, 0.632, 0.706, 0.794, 0.912, 1.0], // $1,900 -> $3,400
  },
  {
    id: "v_aws", name: "AWS", category: "Infrastructure",
    monthlyCost: 4200, contractTerms: "Usage-based, monthly",
    lastContactDate: "2025-12-04", contactEmail: "aws-billing@amazon.com",
    status: "safe", seats: 0, activeSeats: 0, source: "Plaid", functionTag: "cloud_compute",
    trend: [0.93, 0.96, 0.98, 1.02, 1.05, 1.0], // organic growth, not creep
  },
  {
    id: "v_vercel", name: "Vercel", category: "Infrastructure",
    monthlyCost: 2400, contractTerms: "Pro plan, monthly",
    lastContactDate: "2026-01-18", contactEmail: "support@vercel.com",
    status: "safe", seats: 12, activeSeats: 11, source: "Plaid", trend: flat, functionTag: "app_hosting",
  },
  {
    id: "v_figma", name: "Figma", category: "Design",
    monthlyCost: 1080, contractTerms: "Annual", lastContactDate: "2025-12-01",
    contactEmail: "billing@figma.com", status: "safe", functionTag: "design_tool",
    seats: 12, activeSeats: 8, source: "Plaid", trend: flat,
  },
  {
    id: "v_hubspot", name: "HubSpot", category: "Sales",
    monthlyCost: 1450, contractTerms: "Annual", lastContactDate: "2025-10-22",
    contactEmail: "billing@hubspot.com", status: "safe", functionTag: "crm",
    seats: 6, activeSeats: 5, source: "Stripe", trend: flat,
  },
];

function main() {
  resetDb();

  for (const v of SEED_VENDORS) {
    const { source: _s, trend: _t, ...vendor } = v;
    insertVendor(vendor);
  }

  let txCount = 0;
  for (const [periodIdx, date] of PERIODS.entries()) {
    for (const v of SEED_VENDORS) {
      // +/-1.5% jitter so the data reads like a real bank feed, not a spreadsheet.
      const jitter = 1 + (rng() - 0.5) * 0.03;
      const base = v.monthlyCost * v.trend[periodIdx];
      // Contracted vendors bill exactly; usage-based ones vary.
      const usageBased = v.contractTerms.includes("Usage-based");
      const amount = Math.round(usageBased ? base * jitter : base);

      const tx: Transaction = {
        id: `tx_${v.id}_${periodIdx}`,
        vendorId: v.id,
        vendorName: v.name,
        amount,
        date,
        source: v.source,
        flagged: false, // <- the Classifier's job, not the seed's
      };
      insertTransaction(tx);
      txCount += 1;
    }
  }

  const latestSpend = SEED_VENDORS.reduce((sum, v) => sum + v.monthlyCost * v.trend[5], 0);
  console.log(`Seeded ${SEED_VENDORS.length} vendors, ${txCount} transactions across ${PERIODS.length} periods.`);
  console.log(`Latest-period vendor spend: $${Math.round(latestSpend).toLocaleString()}/mo`);
  console.log(`Flagged transactions in seed: 0 (by design — the Classifier must find them)`);
}

main();

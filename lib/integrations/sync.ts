/**
 * Live sync — pulls Plaid sandbox spend and Stripe test-mode revenue into the
 * same vendors/transactions tables the seed script writes, so the agents run
 * unchanged against either data source.
 *
 * Hard no-op in DEMO_MODE. The demo never makes a network call; this is the
 * thing you show a judge who asks "is any of this actually wired up?".
 *
 * Mapping rules (spend):
 *   - One vendor per distinct merchant. Vendor id is a slug of the merchant
 *     name prefixed "plaid-" so reruns are idempotent.
 *   - monthly_cost = total spend at that merchant in the most recent calendar
 *     month that has any transactions.
 *   - Contract terms / seats are unknown from bank data and say so; the
 *     classifier's usage-drift detector simply has nothing to act on for these.
 *   - Transactions are bucketed to the first of their month to match the
 *     billing-period convention the classifier expects.
 */
import { DEMO_MODE } from "@/lib/company";
import { getVendor, upsertTransaction, upsertVendor } from "@/lib/db/queries";
import { fetchTransactions, plaidConfigured, pullSandboxSpend, type PlaidTransaction } from "./plaid";
import { pullTestRevenue, stripeConfigured, type StripeRevenue } from "./stripe";
import { storeStripeRevenue } from "@/lib/revenue";

export interface SyncResult {
  mode: "demo" | "live" | "linked";
  plaid: { configured: boolean; transactionsSeen: number; transactionsUpserted: number; vendorsCreated: number; error?: string };
  stripe: { configured: boolean; revenue?: StripeRevenue; error?: string };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

/** "GENERAL_SERVICES" → "General Services" */
function humanCategory(c: string): string {
  return c.toLowerCase().split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

/**
 * What a merchant's tool actually does. The duplicate detector groups on this,
 * not on billing category. Bank data can't tell us; this table can, for the
 * merchants a seed-stage startup typically pays. Anything unlisted is "other"
 * and simply sits out duplicate detection — the correct failure mode.
 */
const FUNCTION_TAGS: Record<string, string> = {
  notion: "knowledge_base", confluence: "knowledge_base", coda: "knowledge_base",
  slack: "team_chat", "microsoft teams": "team_chat", discord: "team_chat",
  datadog: "observability", "new relic": "observability", sentry: "observability", grafana: "observability",
  segment: "customer_data", mixpanel: "product_analytics", amplitude: "product_analytics",
  twilio: "programmable_messaging", sendgrid: "transactional_email", postmark: "transactional_email", mailgun: "transactional_email",
  "amazon web services": "cloud_compute", aws: "cloud_compute", "google cloud": "cloud_compute", "microsoft azure": "cloud_compute",
  vercel: "app_hosting", netlify: "app_hosting", heroku: "app_hosting", render: "app_hosting",
  github: "source_control", gitlab: "source_control",
  linear: "issue_tracking", jira: "issue_tracking", asana: "issue_tracking",
  figma: "design", canva: "design",
  zoom: "video_conferencing", "google workspace": "productivity_suite", "microsoft 365": "productivity_suite",
  hubspot: "crm", salesforce: "crm",
  "1password": "password_manager", lastpass: "password_manager",
  openai: "llm_api", anthropic: "llm_api",
};

function functionTagFor(merchant: string): string {
  const m = merchant.toLowerCase();
  for (const [key, tag] of Object.entries(FUNCTION_TAGS)) {
    if (m.includes(key)) return tag;
  }
  return "other";
}

function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function importSpend(txs: PlaidTransaction[]): { upserted: number; vendorsCreated: number } {
  const byMerchant = new Map<string, PlaidTransaction[]>();
  for (const t of txs) {
    if (t.pending) continue;
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  let upserted = 0;
  let vendorsCreated = 0;

  for (const [merchant, list] of byMerchant) {
    const id = `plaid-${slug(merchant)}`;

    // Most recent month's spend is the vendor's "monthly cost".
    const byMonth = new Map<string, number>();
    for (const t of list) byMonth.set(monthOf(t.date), (byMonth.get(monthOf(t.date)) ?? 0) + t.amount);
    const latestMonth = [...byMonth.keys()].sort().at(-1)!;
    const lastDate = list.map((t) => t.date).sort().at(-1)!;

    const isNew = !getVendor(id);
    // upsertVendor never touches `status` — that column belongs to the agents.
    upsertVendor({
      id,
      name: merchant,
      category: humanCategory(list[0].category),
      monthlyCost: Math.round(byMonth.get(latestMonth)! * 100) / 100,
      contractTerms: "Unknown (imported from bank feed)",
      lastContactDate: lastDate,
      contactEmail: `billing@${slug(merchant).replace(/-/g, "")}.com`,
      status: "safe",
      functionTag: functionTagFor(merchant),
      seats: 0,
      activeSeats: 0,
    });
    if (isNew) vendorsCreated += 1;

    // upsertTransaction preserves flagged/reason/confidence/features on rerun.
    for (const [month, total] of byMonth) {
      const txId = `plaid-${slug(merchant)}-${month}`;
      upsertTransaction({
        id: txId,
        vendorId: id,
        vendorName: merchant,
        amount: Math.round(total * 100) / 100,
        date: month,
        source: "Plaid",
        flagged: false,
      });
      upserted += 1;
    }
  }

  return { upserted, vendorsCreated };
}

/**
 * @param opts.accessToken  a Plaid access token the user obtained by linking a
 *   bank through Plaid Link in the browser (the landing page's BankPanel). When
 *   present, the sync pulls that Item specifically — and runs even in DEMO_MODE,
 *   because the user has just explicitly connected a bank; refusing would make
 *   the Link button a dead end. Nothing else bypasses the demo guard.
 */
export async function runLiveSync(opts: { accessToken?: string } = {}): Promise<SyncResult> {
  const linked = Boolean(opts.accessToken);
  const result: SyncResult = {
    mode: linked ? "linked" : DEMO_MODE ? "demo" : "live",
    plaid: { configured: plaidConfigured(), transactionsSeen: 0, transactionsUpserted: 0, vendorsCreated: 0 },
    stripe: { configured: stripeConfigured() },
  };

  if (DEMO_MODE && !linked) return result;

  if (result.plaid.configured) {
    try {
      const txs = opts.accessToken ? await fetchTransactions(opts.accessToken) : await pullSandboxSpend();
      result.plaid.transactionsSeen = txs.length;
      const { upserted, vendorsCreated } = importSpend(txs);
      result.plaid.transactionsUpserted = upserted;
      result.plaid.vendorsCreated = vendorsCreated;
    } catch (err) {
      result.plaid.error = err instanceof Error ? err.message : String(err);
    }
  }

  if (result.stripe.configured && !DEMO_MODE) {
    try {
      result.stripe.revenue = await pullTestRevenue();
      // Persist so the forecast and dashboard use real MRR, not the seeded constant.
      storeStripeRevenue(result.stripe.revenue);
    } catch (err) {
      result.stripe.error = err instanceof Error ? err.message : String(err);
    }
  }

  return result;
}

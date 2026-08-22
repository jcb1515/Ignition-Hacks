/**
 * Stripe test-mode client — the revenue side of the live data path.
 *
 * Refuses any key that is not an sk_test_ key. Swapping in a live key under
 * pressure at hour twenty is the single most expensive mistake available in
 * this stack, so the guard is in code rather than in a README.
 *
 * Plain fetch against the REST API with basic auth; no SDK, no new dependency.
 */

const STRIPE_BASE = "https://api.stripe.com/v1";
const TIMEOUT_MS = 15_000;

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  /** Normalised to dollars per month. */
  monthlyAmount: number;
  productName: string;
  currentPeriodEnd: string;
}

export interface StripeRevenue {
  mrr: number;
  activeSubscriptions: number;
  subscriptions: StripeSubscription[];
}

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && key.startsWith("sk_test_"));
}

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY not set (use an sk_test_ key from the Stripe dashboard in test mode)");
  if (!k.startsWith("sk_test_")) {
    throw new Error("Refusing to run: STRIPE_SECRET_KEY is not a test-mode key. Live keys are never used by this app.");
  }
  return k;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${STRIPE_BASE}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key()}:`).toString("base64")}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? `${res.status}`;
    throw new Error(`Stripe ${path} failed: ${msg}`);
  }
  return data as T;
}

interface RawSub {
  id: string;
  customer: string;
  status: string;
  /** Absent on newer API versions, where the period lives on each item. */
  current_period_end?: number;
  items: {
    data: Array<{
      quantity: number;
      current_period_end?: number;
      price: {
        unit_amount: number | null;
        recurring: { interval: "day" | "week" | "month" | "year"; interval_count: number } | null;
        product: string | { name?: string };
      };
    }>;
  };
}

/**
 * Product names, looked up separately. Expanding `data.items.data.price.product`
 * on the subscriptions list is five levels deep and Stripe caps expansion at
 * four, so that request fails on every call.
 */
async function productNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  // Stripe's products list accepts up to 10 ids per call.
  for (let i = 0; i < ids.length; i += 10) {
    const params: Record<string, string> = { limit: "10" };
    ids.slice(i, i + 10).forEach((id, j) => (params[`ids[${j}]`] = id));
    const page = await get<{ data: Array<{ id: string; name?: string }> }>("/products", params);
    for (const pr of page.data) if (pr.name) names.set(pr.id, pr.name);
  }
  return names;
}

function perMonth(unitCents: number, qty: number, interval: string, count: number): number {
  const dollars = (unitCents / 100) * qty;
  switch (interval) {
    case "year": return dollars / (12 * count);
    case "month": return dollars / count;
    case "week": return (dollars * 52) / 12 / count;
    case "day": return (dollars * 365) / 12 / count;
    default: return dollars;
  }
}

/** ISO date of the current period end, wherever this API version puts it. */
function periodEnd(s: RawSub): string {
  const secs = s.current_period_end ?? s.items.data.map((i) => i.current_period_end).find((n) => typeof n === "number");
  return typeof secs === "number" && Number.isFinite(secs) ? new Date(secs * 1000).toISOString().slice(0, 10) : "";
}

/** All subscriptions (any status) plus the MRR of the active ones. */
export async function pullTestRevenue(): Promise<StripeRevenue> {
  const subs: StripeSubscription[] = [];
  let startingAfter: string | undefined;
  const raw: RawSub[] = [];

  for (;;) {
    const page = await get<{ data: RawSub[]; has_more: boolean }>("/subscriptions", {
      status: "all",
      limit: "100",
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    raw.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  const productIds = new Set<string>();
  for (const s of raw) for (const item of s.items.data) {
    if (typeof item.price.product === "string") productIds.add(item.price.product);
  }
  const names = await productNames([...productIds]);

  for (const s of raw) {
    let monthly = 0;
    let productName = "Subscription";
    for (const item of s.items.data) {
      const p = item.price;
      if (p.unit_amount == null || !p.recurring) continue;
      monthly += perMonth(p.unit_amount, item.quantity ?? 1, p.recurring.interval, p.recurring.interval_count);
      if (typeof p.product === "object" && p.product.name) productName = p.product.name;
      else if (typeof p.product === "string" && names.has(p.product)) productName = names.get(p.product)!;
    }
    subs.push({
      id: s.id,
      customer: s.customer,
      status: s.status,
      monthlyAmount: Math.round(monthly * 100) / 100,
      productName,
      currentPeriodEnd: periodEnd(s),
    });
  }

  const active = subs.filter((s) => s.status === "active" || s.status === "trialing");
  return {
    mrr: Math.round(active.reduce((a, s) => a + s.monthlyAmount, 0) * 100) / 100,
    activeSubscriptions: active.length,
    subscriptions: subs,
  };
}

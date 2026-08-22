/**
 * Offline smoke test for the integration + Q&A layer. No network, no keys.
 * Runs against a throwaway DB so it never touches runway.db.
 *
 *   DATABASE_PATH=/tmp/rr-int.db npx tsx scripts/smoke-integrations.ts
 *
 * (scripts/preflight.ts sets DATABASE_PATH for you.)
 */
import { execFileSync } from "node:child_process";
import { importSpend } from "../lib/integrations/sync";
import { stripeConfigured, pullTestRevenue } from "../lib/integrations/stripe";
import { plaidConfigured } from "../lib/integrations/plaid";
import { ask } from "../lib/ask";
import { buildInvestorUpdate } from "../lib/investor-update";
import { lookupBillingContact, resolveBillingContact, type SearchProvider } from "../lib/agents/negotiator";
import type { Vendor } from "../lib/types";
import { runAudit } from "../lib/agents/orchestrator";
import { runNegotiation, MAX_ROUNDS, TOLERANCE, type NegotiationSummary } from "../lib/agents/negotiation";
import { APPROVAL_THRESHOLD } from "../lib/company";
import { getTransactionsForVendor, getVendor, setVendorStatus } from "../lib/db/queries";
import { resetDb } from "../lib/db";

let failures = 0, checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n        ${detail}` : ""}`);
  if (!ok) failures += 1;
}
const section = (t: string) => console.log(`\n${t}`);

async function main() {
  console.log("Runway Radar integration smoke test\n" + "=".repeat(50));

  /* ---- Plaid import, offline ---- */
  section("Plaid import (fake payload)");
  resetDb();
  const fake = [
    { transactionId: "a", merchant: "Datadog", amount: 1200, date: "2026-01-14", category: "GENERAL_SERVICES", pending: false },
    { transactionId: "b", merchant: "Datadog", amount: 1300, date: "2026-02-14", category: "GENERAL_SERVICES", pending: false },
    { transactionId: "c", merchant: "Notion Labs", amount: 96, date: "2026-02-03", category: "GENERAL_SERVICES", pending: false },
    { transactionId: "d", merchant: "Uber Eats", amount: 42, date: "2026-02-05", category: "FOOD_AND_DRINK", pending: false },
    { transactionId: "e", merchant: "Pending Co", amount: 9, date: "2026-02-05", category: "FOOD_AND_DRINK", pending: true },
  ];
  const r1 = importSpend(fake);
  check("creates one vendor per merchant", r1.vendorsCreated === 3, `got ${r1.vendorsCreated}`);
  check("skips pending transactions", !getVendor("plaid-pending-co"));
  check("buckets to billing period", getTransactionsForVendor("plaid-datadog").every((t) => t.date.endsWith("-01")));
  check("monthly cost = latest month", getVendor("plaid-datadog")?.monthlyCost === 1300);
  check("maps function tag", getVendor("plaid-datadog")?.functionTag === "observability" && getVendor("plaid-notion-labs")?.functionTag === "knowledge_base");
  check("unknown merchant → other", getVendor("plaid-uber-eats")?.functionTag === "other");
  setVendorStatus("plaid-datadog", "flagged");
  const r2 = importSpend(fake);
  check("rerun is idempotent", r2.vendorsCreated === 0 && getTransactionsForVendor("plaid-datadog").length === 2);
  check("rerun preserves agent-set status", getVendor("plaid-datadog")?.status === "flagged");

  /* ---- Stripe guard ---- */
  section("Stripe guard");
  const saved = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_live_should_never_work";
  check("live key is not 'configured'", !stripeConfigured());
  let threw = false;
  try { await pullTestRevenue(); } catch (e) { threw = /not a test-mode key/.test(String(e)); }
  check("live key throws before any request", threw);
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  check("test key is configured", stripeConfigured());
  if (saved === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = saved;
  check("plaid unconfigured without keys", plaidConfigured() === Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET));

  /* ---- Billing-contact resolver (tool call #1 of the Negotiator) ---- */
  section("Contact resolver");
  const vendor: Vendor = {
    id: "v_test", name: "Atlassian", category: "Productivity", monthlyCost: 420,
    contractTerms: "monthly", lastContactDate: "2025-06-01", contactEmail: "support@atlassian.com",
    status: "safe", functionTag: "knowledge_base", seats: 12, activeSeats: 4,
  };
  const hit = (email: string, citation?: string): SearchProvider => async () => ({ email, source: "stub search", citation });
  const nothing: SearchProvider = async () => undefined;
  const boom: SearchProvider = async () => { throw new Error("provider down"); };
  const garbage: SearchProvider = async () => ({ email: "not an email", source: "stub" });
  let calls = 0;
  const counting: SearchProvider = async () => { calls += 1; return undefined; };

  let r = await resolveBillingContact(vendor, []);
  check("no providers → vendor record", r.email === "support@atlassian.com" && r.source === "vendor record on file");
  r = await resolveBillingContact(vendor, [nothing, boom, garbage]);
  check("empty / throwing / malformed providers → fall through, never throw", r.source === "vendor record on file");
  r = await resolveBillingContact(vendor, [hit("billing@some-aggregator.io", "https://aggregator.io")]);
  check("off-domain address is rejected", r.email === "support@atlassian.com", `accepted ${r.email}`);
  r = await resolveBillingContact(vendor, [hit("admin@atlassian.com.evil.net")]);
  check("look-alike domain is rejected", r.email === "support@atlassian.com", `accepted ${r.email}`);
  r = await resolveBillingContact(vendor, [hit("sales-ops-support@atlassian.com", "https://atlassian.com/contact")]);
  check("same-domain address is accepted with citation", r.email === "sales-ops-support@atlassian.com" && r.citation === "https://atlassian.com/contact" && r.source === "stub search");
  r = await resolveBillingContact(vendor, [hit("ar@billing.atlassian.com")]);
  check("subdomain of vendor domain is accepted", r.email === "ar@billing.atlassian.com");
  r = await resolveBillingContact(vendor, [boom, hit("ar@atlassian.com"), counting]);
  check("first good tier wins; later tiers not called", r.email === "ar@atlassian.com" && calls === 0);
  r = await resolveBillingContact({ ...vendor, contactEmail: "" }, [hit("x@atlassian.com")]);
  check("no domain on file → providers skipped, inferred alias", r.source === "inferred billing alias");
  const liar: SearchProvider = async () => ({ email: "x@evil.com", source: "live web search (Composio)" });
  r = await resolveBillingContact(vendor, [liar]);
  check("provider claiming a verified source cannot smuggle an off-domain address", r.email === "support@atlassian.com");
  r = await resolveBillingContact({ ...vendor, contactEmail: "nonsense" }, [counting]);
  check("contactEmail without @ → providers skipped, inferred alias", calls === 0 && r.email.includes("@") && r.source === "inferred billing alias");
  r = await lookupBillingContact(vendor);
  check("DEMO_MODE entry point makes no lookups", r.source === "vendor record on file");

  /* ---- Q&A + slide on a real audit ---- */
  section("Ask + investor update (seeded audit)");
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { stdio: "pipe", env: process.env });
  for await (const ev of runAudit()) { if (ev.type === "done") break; }

  const expect: Array<[string, string, RegExp]> = [
    ["Why did you flag Twilio?", "why_flagged", /4\.00x/],
    ["what's our runway", "runway", /9\.4 months/],
    ["how much can we save", "savings", /\$76,620/],
    ["what's waiting on me", "pending", /^2 decisions/],
    ["what is the approval threshold", "threshold", /\$1,000/],
    ["tell me about Vercel", "vendor_detail", /Not flagged/],
    ["summary", "summary", /flagged 4/],
    ["what color is the sky", "unknown", /I can answer from the audit/],
  ];
  for (const [q, intent, re] of expect) {
    const a = await ask(q);
    check(`"${q}" → ${intent}`, a.intent === intent && re.test(a.answer), `got ${a.intent}: ${a.answer.slice(0, 90)}`);
  }
  const a = await ask("anything");
  check("never calls an LLM in demo mode", a.source !== "llm");

  /* ---- Negotiation loop ---- */
  section("Negotiation loop (after audit)");
  const outcomes: Record<string, NegotiationSummary> = {};
  const threads: Record<string, string[]> = {};
  for (const id of ["v_twilio", "v_confluence", "v_segment", "v_datadog"]) {
    const types: string[] = [];
    for await (const ev of runNegotiation(id)) {
      if (ev.type === "action") types.push(ev.action.type);
      if (ev.type === "done") outcomes[id] = ev.summary;
    }
    threads[id] = types;
  }
  const byKind = Object.fromEntries(Object.values(outcomes).map((o) => [o.kind, o]));
  check("every flagged vendor negotiated", Object.keys(outcomes).length === 4 && Object.values(outcomes).every((o) => o.outcome !== "no_flag"));
  check("all four kinds exercised", ["overpriced", "duplicate", "usage_drift", "price_creep"].every((k) => k in byKind));
  check("rounds bounded", Object.values(outcomes).every((o) => o.rounds >= 1 && o.rounds <= MAX_ROUNDS));
  for (const o of Object.values(outcomes)) {
    const acceptable = Math.round(o.targetMonthly * (1 + TOLERANCE));
    const savings = o.startMonthly - o.bestOfferMonthly;
    if (o.outcome === "accepted") check(`${o.vendorName}: accepted ⇒ offer ≤ ceiling and savings ≤ threshold`, o.bestOfferMonthly <= acceptable && savings <= APPROVAL_THRESHOLD && o.realisedMonthlySavings === savings);
    if (o.outcome === "pending_approval") check(`${o.vendorName}: pending ⇒ offer ≤ ceiling and savings > threshold, nothing realised`, o.bestOfferMonthly <= acceptable && savings > APPROVAL_THRESHOLD && o.realisedMonthlySavings === 0);
    if (o.outcome === "escalated") check(`${o.vendorName}: escalated ⇒ offer > ceiling, nothing realised, human flagged`, o.bestOfferMonthly > acceptable && o.realisedMonthlySavings === 0 && threads[o.vendorId].at(-1) === "negotiation_escalated");
  }
  check("duplicate cancels autonomously and marks vendor cancelled", byKind.duplicate?.outcome === "accepted" && getVendor("v_confluence")?.status === "cancelled");
  check("usage_drift deal is gated by the threshold", byKind.usage_drift?.outcome === "pending_approval");
  check("overpriced escalates when vendor stops short of target", byKind.overpriced?.outcome === "escalated");
  check("vendor offers never exceed starting cost", Object.values(outcomes).every((o) => o.bestOfferMonthly <= o.startMonthly));
  check("thread alternates agent/vendor turns", Object.values(threads).every((t) => t.filter((x) => x === "negotiation_round").length === t.filter((x) => x.startsWith("vendor_")).length));
  const again: string[] = [];
  for await (const ev of runNegotiation("v_twilio")) { if (ev.type === "action") again.push(ev.action.type); }
  check("negotiation is deterministic", JSON.stringify(again) === JSON.stringify(threads.v_twilio));
  let noFlag: NegotiationSummary | undefined;
  for await (const ev of runNegotiation("v_vercel")) { if (ev.type === "done") noFlag = ev.summary; }
  check("unflagged vendor → no_flag, no actions", noFlag?.outcome === "no_flag");

  const negQ = await ask("how did the Segment negotiation go?");
  check("ask: negotiation summary after the loop", negQ.intent === "negotiation" && /sign-off/.test(negQ.answer), negQ.answer);
  const negQ2 = await ask("what's the Confluence deal");
  check("ask: autonomous close reported", negQ2.intent === "negotiation" && /closed it myself/.test(negQ2.answer), negQ2.answer);

  const u = buildInvestorUpdate();
  check("slide: audited", u.audited);
  check("slide: 4 findings", u.findings.length === 4, `got ${u.findings.length}`);
  check("slide: headline carries annual savings", /\$76,620\/yr/.test(u.headline), u.headline);
  check("slide: pending = distinct vendors awaiting a human (Twilio, Segment, Datadog)", u.governance.pending === 3, `got ${u.governance.pending}`);
  check("slide: runway gain > 0", u.runway.monthsGained > 0);
  check("slide: every finding has a why", u.findings.every((f) => f.why.length > 5));

  console.log("\n" + "=".repeat(50));
  if (failures) { console.log(`${failures} of ${checks} checks FAILED`); process.exit(1); }
  console.log(`ALL ${checks} CHECKS PASSED`);
}

main().catch((e) => { console.error(e); process.exit(1); });

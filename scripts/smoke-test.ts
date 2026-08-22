/**
 * Pre-demo smoke test.
 *
 * Run this once immediately before your judging slot. It reseeds, runs the
 * full agent chain, and asserts that the deliberately planted anomalies are
 * caught. If it fails, do not debug live — switch to the recorded video.
 *
 *   npm run smoke
 *
 * Exits non-zero on any failure so it can gate a script or a CI step.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classify } from "../lib/agents/classifier";
import { forecast, estimateSavings } from "../lib/agents/forecast";
import { runAudit } from "../lib/agents/orchestrator";
import { deliver } from "../lib/mailer";
import { APPROVAL_THRESHOLD } from "../lib/company";
import { importSpendFile } from "../lib/import";
import { seed } from "../lib/db/seed";
import { getTransactions, getVendors, getDrafts } from "../lib/db/queries";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

async function main() {
  console.log("Burn Shield smoke test\n" + "=".repeat(50));

  /* ---- seed ---- */
  section("Seed");
  seed();

  const txs = getTransactions();
  const vendors = getVendors();
  check("vendors seeded", vendors.length === 12, `got ${vendors.length}, want 12`);
  check("transactions seeded", txs.length === 72, `got ${txs.length}, want 72`);
  check(
    "seed contains no pre-set flags",
    txs.every((t) => !t.flagged),
    "the classifier must find anomalies, not read them from the seed"
  );

  /* ---- determinism ---- */
  section("Determinism");
  const before = JSON.stringify(getTransactions().map((t) => [t.id, t.amount]));
  seed();
  const after = JSON.stringify(getTransactions().map((t) => [t.id, t.amount]));
  check("reseed is byte-identical", before === after, "seed PRNG is not deterministic");

  /* ---- repeated CSV / JSON imports ---- */
  section("Import refresh cycles");
  const csv = readFileSync(join(process.cwd(), "public", "sample-spend.csv"), "utf8");
  const csvResult = importSpendFile(csv, "sample-spend.csv", { replace: true });
  const csvForecast = forecast();
  check("CSV import replaces vendor data", csvResult.vendors === 12 && getVendors().length === 12);
  check("CSV totals drive the forecast", csvForecast.vendorSpend === 26_421, `got ${csvForecast.vendorSpend}`);
  check("CSV import clears prior findings and approvals", getTransactions().every((t) => !t.flagged) && getDrafts().length === 0);

  for await (const event of runAudit()) { if (event.type === "done") break; }
  check("audit repopulates imported findings", getTransactions().filter((t) => t.flagged).length === 4);
  check("audit repopulates imported approvals", getDrafts().length === 4);

  const json = JSON.stringify([
    { vendor: "Alpha Cloud", amount: 100, date: "2026-01-01", category: "Infrastructure" },
    { vendor: "Alpha Cloud", amount: 150, date: "2026-02-01", category: "Infrastructure" },
    { vendor: "Beta CRM", amount: 300, date: "2026-01-01", category: "Sales" },
    { vendor: "Beta CRM", amount: 900, date: "2026-02-01", category: "Sales" },
  ]);
  const jsonResult = importSpendFile(json, "custom-spend.json", { replace: true });
  const jsonForecast = forecast();
  check("JSON import replaces the previous CSV", jsonResult.vendors === 2 && getVendors().length === 2);
  check("JSON totals immediately drive the forecast", jsonForecast.vendorSpend === 1_050, `got ${jsonForecast.vendorSpend}`);
  check("JSON history reflects uploaded monthly totals", jsonForecast.history.at(-1)?.vendorSpend === 1_050);
  check("second import clears stale findings and approvals", getTransactions().every((t) => !t.flagged) && getDrafts().length === 0);

  seed();

  /* ---- classifier: the Tier 1 gate ---- */
  section("Classifier (Tier 1 gate)");
  const flags = classify();
  const byVendor = new Map(flags.map((f) => [f.vendorName, f]));

  const expected: Array<[string, string]> = [
    ["Twilio", "overpriced"],
    ["Confluence", "duplicate"],
    ["Segment", "usage_drift"],
    ["Datadog", "price_creep"],
  ];

  for (const [vendor, kind] of expected) {
    const f = byVendor.get(vendor);
    check(`${vendor} flagged as ${kind}`, f?.kind === kind, f ? `got kind "${f.kind}"` : "not flagged at all");
    if (f) {
      check(`${vendor} confidence >= 0.6`, f.confidence >= 0.6, `got ${f.confidence}`);
      check(`${vendor} has a feature breakdown`, f.features.length >= 2, `got ${f.features.length} features`);
      const sorted = [...f.features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      check(
        `${vendor} breakdown is sorted by impact`,
        JSON.stringify(sorted) === JSON.stringify(f.features)
      );
    }
  }

  check(
    "no false positives",
    flags.length === expected.length,
    `flagged ${flags.length}: ${flags.map((f) => f.vendorName).join(", ")}`
  );

  // Vendors that must never fire — the near-misses that prove the thresholds work.
  for (const safe of ["Notion", "Slack", "Linear", "AWS", "Vercel", "Figma", "Zoom", "HubSpot"]) {
    check(`${safe} not flagged`, !byVendor.has(safe));
  }

  /* ---- forecast ---- */
  section("Forecast");
  const f = forecast(flags);
  check("three scenarios produced", f.scenarios.length === 3, `got ${f.scenarios.length}`);
  check("savings are positive", f.totalMonthlySavings > 0, `got ${f.totalMonthlySavings}`);
  check(
    "cutting costs extends the cash horizon",
    f.scenarios[1].runwayMonths > f.scenarios[0].runwayMonths,
    `${f.scenarios[1].runwayMonths} vs ${f.scenarios[0].runwayMonths}`
  );
  check(
    "hiring freeze extends further still",
    f.scenarios[2].runwayMonths > f.scenarios[1].runwayMonths
  );

  for (const s of f.scenarios) {
    const mc = f.monteCarlo[s.label];
    check(`${s.label}: Monte Carlo band is ordered`, mc.p10 <= mc.p50 && mc.p50 <= mc.p90,
      `p10=${mc.p10} p50=${mc.p50} p90=${mc.p90}`);
    check(`${s.label}: band is not degenerate`, mc.p90 > mc.p10,
      "percentiles collapsed onto one value — the variance model is broken");
    check(`${s.label}: deterministic projection sits inside the band`,
      s.runwayMonths >= mc.p10 && s.runwayMonths <= mc.p90,
      `point estimate ${s.runwayMonths} outside [${mc.p10}, ${mc.p90}]`);
  }

  check("savings never exceed the vendor's own cost", flags.every((fl) => {
    const v = vendors.find((x) => x.id === fl.vendorId);
    return v ? estimateSavings(fl, vendors) <= v.monthlyCost : false;
  }));

  /* ---- orchestrator ---- */
  section("Orchestrator");
  let summary: Awaited<ReturnType<typeof collect>> | null = null;
  summary = await collect();

  check("audit completed", summary !== null);
  if (summary) {
    check("found all four", summary.flagsFound === 4, `got ${summary.flagsFound}`);
    check("drafted one email per flag", summary.draftsCreated === 4, `got ${summary.draftsCreated}`);
    check("held the expensive ones for a human", summary.pendingApproval === 2,
      `got ${summary.pendingApproval}; Twilio and Segment should exceed the $${APPROVAL_THRESHOLD} threshold`);
    check("cash horizon improves after remediation", summary.runwayAfter > summary.runwayBefore,
      `${summary.runwayBefore} -> ${summary.runwayAfter}`);
  }

  const drafts = getDrafts();
  check("drafts persisted", drafts.length === 4, `got ${drafts.length}`);
  check("no draft was auto-sent", drafts.every((d) => !d.sent),
    "a draft was transmitted without a human decision");
  check("every draft has a body", drafts.every((d) => d.body.trim().length > 50));

  /* ---- safety ---- */
  section("Safety");
  const originalHost = process.env.SMTP_HOST;
  process.env.SMTP_HOST = "smtp.sendgrid.net";
  process.env.SMTP_USER = "x";
  process.env.SMTP_PASS = "y";
  let threw = false;
  try {
    await deliver(drafts[0]);
  } catch {
    threw = true;
  }
  check("mailer refuses a non-sandbox SMTP host", threw,
    "deliver() accepted a production mail host — the sandbox guard is not working");
  if (originalHost === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = originalHost;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  /* ---- result ---- */
  console.log("\n" + "=".repeat(50));
  if (failures === 0) {
    console.log(`ALL ${checks} CHECKS PASSED — safe to demo live.`);
  } else {
    console.log(`${failures} of ${checks} CHECKS FAILED — use the recorded video instead.`);
  }
  process.exit(failures === 0 ? 0 : 1);
}

async function collect() {
  for await (const ev of runAudit()) {
    if (ev.type === "done") return ev.summary;
  }
  return null;
}

main();

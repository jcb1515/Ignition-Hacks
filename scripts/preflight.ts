/**
 * T-minus-10 preflight. Run this right before your judging slot:
 *
 *   npx tsx scripts/preflight.ts            # assumes dev server on :3000
 *   BASE_URL=http://localhost:3000 npx tsx scripts/preflight.ts
 *
 * Checks, in order: env is demo-safe, no live keys, DB seeded, both smoke
 * suites pass, the running server answers every route the demo touches.
 * Any failure → exit 1 → play the backup recording instead of debugging live.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;
const ok = (name: string, pass: boolean, detail = "") => {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? `\n        ${detail}` : ""}`);
  if (!pass) failures += 1;
};

/* ---- env ---- */
console.log("Preflight\n" + "=".repeat(50) + "\nEnvironment");
const envFile = join(process.cwd(), ".env.local");
const env: Record<string, string> = { ...process.env } as Record<string, string>;
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
ok("DEMO_MODE is on (unset or 'true')", env.DEMO_MODE !== "false", "set DEMO_MODE=true before judging — live calls are a wifi dependency");
ok("no live Stripe key", !(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_"), "a live key must never be present");
ok("no live Plaid env", !/production|development/i.test(env.PLAID_ENV ?? ""), "sandbox only");
ok("SMTP, if set, is a sandbox host", !env.SMTP_HOST || /mailtrap|sandbox/i.test(env.SMTP_HOST), `SMTP_HOST=${env.SMTP_HOST}`);
ok("runway.db exists", existsSync(join(process.cwd(), env.DATABASE_PATH ?? "runway.db")), "run `npm run seed`");
ok("backup recording exists (docs/backup-demo.gif)", existsSync(join(process.cwd(), "docs", "backup-demo.gif")), "the fallback is not optional — record it before judging");

/* ---- suites ---- */
console.log("\nSmoke suites");
const run = (label: string, args: string[], extraEnv: Record<string, string> = {}) => {
  try {
    const out = execFileSync("npx", ["tsx", ...args], { stdio: "pipe", env: { ...process.env, ...extraEnv }, timeout: 180_000 }).toString();
    const last = out.trim().split("\n").at(-1) ?? "";
    ok(`${label}: ${last}`, /ALL .* PASSED/.test(last));
  } catch (e) {
    const out = (e as { stdout?: Buffer }).stdout?.toString() ?? String(e);
    ok(label, false, out.split("\n").filter((l) => l.includes("FAIL")).join(" | ").slice(0, 300));
  }
};
run("agents + seed (npm run smoke)", ["scripts/smoke-test.ts"]);
const scratchDb = join(process.cwd(), ".preflight-int.db");
run("integrations + ask + slide", ["scripts/smoke-integrations.ts"], { DATABASE_PATH: scratchDb });
for (const f of [scratchDb, `${scratchDb}-wal`, `${scratchDb}-shm`]) rmSync(f, { force: true });

/* ---- server ---- */
console.log(`\nServer (${BASE})`);
const routes = ["/", "/dashboard", "/investor-update", "/api/state", "/api/sync", "/api/investor-update"];
const main = async () => {
  let reachable = true;
  for (const r of routes) {
    try {
      const res = await fetch(BASE + r, { signal: AbortSignal.timeout(30_000) });
      ok(`${r} → ${res.status}`, res.ok);
    } catch (e) {
      reachable = false;
      ok(r, false, `unreachable — is \`npm run dev\` running? (${String(e).slice(0, 80)})`);
    }
  }
  if (reachable) {
    const sync = await fetch(BASE + "/api/sync").then((r) => r.json()).catch(() => null);
    ok("server reports demo mode", sync?.mode === "demo", `got ${JSON.stringify(sync)}`);
    const ask = await fetch(BASE + "/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "summary" }) })
      .then((r) => r.json()).catch(() => null);
    ok("/api/ask answers", typeof ask?.answer === "string" && ask.answer.length > 20);
    // The demo narrative assumes a seeded, already-audited dashboard is NOT required — reseed is the first click.
    const reset = await fetch(BASE + "/api/reset", { method: "POST" }).then((r) => r.json()).catch(() => null);
    ok("reseed from the dashboard works", reset?.ok === true);
  }

  console.log("\n" + "=".repeat(50));
  if (failures) { console.log(`${failures} PREFLIGHT CHECK(S) FAILED — use the backup recording.`); process.exit(1); }
  console.log("PREFLIGHT CLEAR — go.");
};
main();

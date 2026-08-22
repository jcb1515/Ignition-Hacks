// Scripted backup recording. Needs playwright installed somewhere on the machine:
//   npm i -g playwright && npx playwright install chromium
//   node scripts/record-backup.mjs /tmp/out   → /tmp/out/backup-demo.webm  (dev server must be on :3000)
import { chromium } from "playwright";
import { readdirSync, renameSync } from "node:fs";
const BASE = "http://localhost:3000";
const OUT = process.argv[2];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let shot = 0; const snap = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2,"0")}-${name}.png` }); };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ...(process.env.SHOTS ? {} : { recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } }),
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const scrollTo = async (loc) => { await loc.scrollIntoViewIfNeeded(); await pause(400); };

await fetch(BASE + "/api/reset", { method: "POST" });
await page.goto(BASE + "/#try", { waitUntil: "networkidle" });
await pause(3000);                                              // 0:00 clean state + badge

await page.getByRole("button", { name: /run audit/i }).click(); // 0:03 run audit
await pause(11000); await snap("log");

const log = page.getByText(/exceeds the .*autonomy threshold/i).first();
if (await log.count()) await scrollTo(log);
await pause(4000);

const twilio = page.getByRole("button", { name: /twilio/i }).first(); // 0:17 expand Twilio flag
if (await twilio.count()) { await scrollTo(twilio); await twilio.click(); await pause(600); await page.mouse.wheel(0, 380); }
await pause(6000); await snap("twilio-flag");

const queueTwilio = page.getByRole("button", { name: /twilio/i }).nth(1); // 0:23 approval queue
const approveBtn = page.getByRole("button", { name: /approve and send/i }).first();
if (await queueTwilio.count()) { await scrollTo(queueTwilio); await queueTwilio.click(); await pause(2500); }
if (await approveBtn.count()) { await scrollTo(approveBtn); await pause(1500); await approveBtn.click(); } // 0:29 approve
await pause(6000); await snap("approved");

// Negotiation beat (renders once <NegotiationThread /> is mounted in the approval queue;
// harmless no-op if the button isn't there yet).
const negotiate = page.getByRole("button", { name: /^negotiate$/i }).first();
if (await negotiate.count()) {
  await scrollTo(negotiate); await negotiate.click();
  await pause(9000);                                             // ~7 turns at 380ms + reads
  const accept = page.getByRole("button", { name: /^accept \$/i }).first();
  if (await accept.count()) { await scrollTo(accept); await pause(1500); await accept.click(); await pause(2500); }
  await snap("negotiation");
}

const chart = page.getByText(/runway/i).first();                // 0:37 runway chart
if (await chart.count()) await scrollTo(chart);
await pause(5000);

const ask = page.getByPlaceholder(/type a question/i);          // 0:42 ask the agent
if (await ask.count()) {
  await scrollTo(ask);
  await ask.click();
  await ask.pressSequentially("why did you flag Segment?", { delay: 45 });
  await pause(500);
  await ask.press("Enter");
}
await pause(8000); await snap("ask");

const inv = page.getByRole("link", { name: /investor update/i }).first(); // 0:50 closer
if (await inv.count()) { await scrollTo(inv); await inv.click(); await page.waitForLoadState("networkidle"); }
await pause(8000); await snap("slide");

await ctx.close();
await browser.close();
const f = readdirSync(OUT).find((x) => x.endsWith(".webm"));
if (f) { renameSync(`${OUT}/${f}`, `${OUT}/backup-demo.webm`); console.log("recorded", `${OUT}/backup-demo.webm`); }

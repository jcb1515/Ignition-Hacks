# Burn Shield — Demo Script & Judging Checklist

Five minutes. One click path. Every number below comes from the seeded dataset and
is byte-identical on every run in demo mode, so what you rehearse is what judges see.

## T-minus 10 minutes (do all of these, in order)

```bash
cat .env.local | grep DEMO_MODE        # must be unset or "true" on stage
npm run seed                           # fresh DB: 12 vendors, 6 periods, 0 flags
npx tsx scripts/preflight.ts           # env sanity + both smoke suites + every demo route
npm run dev                            # local, not hosted — no cold starts
open http://localhost:3000/#try
```

If preflight prints anything but `PREFLIGHT CLEAR`: **do not debug live.** Play the backup recording.

```bash
ls -la docs/backup-demo.mp4                # the fallback must exist before you walk in
open docs/backup-demo.mp4                  # QuickTime plays the .mp4 — keep it open, paused at 0:00
```

Also: laptop on power, notifications off, browser zoom 110%, backup video open in a second tab.

## The click path (≈4 min)

1. **Landing → Dashboard** (10s)
   "Most startups don't die from one big mistake. They die from slow leakage nobody audits
   until it's too late. Burn Shield is an agent that watches vendor spend continuously and
   only escalates the decisions that actually need a human."

2. **Point at the data-source badge** (10s)
   "It's in deterministic demo mode against seeded sandbox data so this is reliable on stage.
   The Plaid sandbox and Stripe test-mode path is wired underneath — happy to show it after."
   *(Say this unprompted. Judges trust the team that volunteers it.)*

3. **Click "Run audit"** (60s — narrate while it streams)
   - Orchestrator announces mode + the $1,000/mo approval threshold.
   - Classifier flags four vendors. Read the strongest signal on each as it appears:
     - **Twilio** — 4.0× the Communication-category mean → overpriced
     - **Confluence** — duplicate of Notion; 33% vs 86% utilisation
     - **Segment** — 6 of 50 seats active (12%) → paying for unused seats
     - **Datadog** — +78% over six periods, no plan change → silent price creep
   - Forecast runs three scenarios + a 4,000-trial Monte Carlo.
   - Negotiator **searches the web** for each vendor's billing contact, cites its source
     in the log, then drafts — "two real tool calls, not two prompts." Read one citation
     aloud (e.g. Atlassian's sales-ops-support@ address). If search is unavailable it says
     so and uses the address on file — never a made-up one.

4. **Expand one flag card → feature breakdown** (30s)
   "This is the explainability layer. Each flag is a linear score whose per-feature
   contributions are the exact Shapley decomposition — so 'why did it fire' is answerable
   with numbers, not a paragraph from a language model."

5. **Approval queue** (40s)
   Two drafts are held because their impact exceeds $1,000/mo.
   "The agent drafts, it does not send. Anything above threshold stops here."
   Approve **Twilio**. The email lands in the Mailtrap sandbox inbox — show it if there's time.
   "No code path in this app can reach a real vendor's mailbox. That's deliberate."

5b. **Negotiate** (40s — the agentic flex)
   In the same expanded draft, press **Negotiate**. Watch the thread build: ask, vendor
   counter, evaluate, counter, vendor's final, decision.
   Pick the vendor by the story you want:
   - **Confluence** — declines the retention discount, vendor accepts the cancel, agent
     closes it *itself* ($420 < threshold). "Under threshold, it acts."
   - **Segment** — reaches $1,024/mo (from $3,200) but **holds**: "$2,176/mo is above the
     threshold. It can haggle alone; it cannot sign alone."
   - **Twilio** — vendor stops at 25% off, agent's target is 50%; it **escalates**: "It knows
     when to stop negotiating and hand it back."
   Then ask the agent: *"how did the Segment negotiation go?"*

6. **Cash-horizon chart** (20s)
   "Acting on all four moves the cash horizon from 9.4 to 10.1 months — $76,620 a year recovered
   from tools nobody was looking at."

7. **Ask it out loud** (30s, optional — only if the room is quiet)
   Click the mic in "Ask the agent" and say: *"Why did you flag Twilio?"*
   It answers from its own action log (not an LLM) and reads the Shapley breakdown back.
   Fallbacks: type the question, or click a suggestion chip. If the mic permission prompt
   appears, that is the moment to say "browser speech API, nothing hosted."

8. **Closer: /investor-update** (30s)
   Open `http://localhost:3000/investor-update`.
   "And the agent writes its own board slide from its own action log. ⌘P, it's a PDF."
   End on this screen. Do not go back to the log.

## Headline numbers (memorise)

| | |
|---|---|
| Vendors audited | 12 |
| Vendor spend | $26,422 / mo |
| Anomalies | 4 (0 false positives) |
| Recoverable | $6,385 / mo · $76,620 / yr |
| Cash horizon | 9.4 → 10.1 months (+0.7) |
| Held for approval | 2 of 4 drafts |

## Likely judge questions

**"Is this live or scripted?"**
Demo mode against seeded data, deliberately, so the showcase is deterministic. The live path
(`DEMO_MODE=false`, Plaid sandbox + Stripe test keys, `POST /api/sync`) feeds the same tables
and the same agents. Offer to show it — and if Plaid keys are configured, the strongest
version is on the landing page: **Connect a bank** (Plaid Link, sandbox credentials
`user_good` / `pass_good`) → the linked Item syncs into the agent tables via
`POST /api/sync { accessToken }` → **Run audit**. Same agents, a bank the judge just linked.

**"Why four agents instead of one?"**
Narrow jobs are debuggable and explainable. The Orchestrator is the only one that decides;
the others are tools it invokes. That's also what lets the approval threshold be a single,
auditable policy rather than a prompt instruction.

**"What stops it from sending something dumb?"**
Dollar threshold + drafts-only + sandbox-only SMTP (the mailer throws on any non-Mailtrap host).
Be honest: the threshold is a policy choice, not a solved problem. A real deployment needs
stronger guardrails before an agent touches a vendor relationship unsupervised.

**"Is the explainability real SHAP?"**
For a linear scorer the per-feature contributions *are* the exact Shapley values — no
approximation needed. It's SHAP in spirit and in math, without a trained model to explain.

**"What would you build next?"**
Continuous mode (re-audit on every new Plaid transaction), a real contract-terms parser so
renewal dates drive timing, and a feedback loop where rejected drafts tune the threshold.

## Backup recording — one-take shot list

Two copies of the same 75-second scripted capture (includes the negotiation beat) (real motion, real paced stream, real Mailtrap
delivery), verified frame-by-frame:

- **`docs/backup-demo.mp4`** — H.264. Plays in QuickTime, Safari, Chrome, Brave, anything. **Use this one.**
- `docs/backup-demo.webm` — the original VP8 capture. Chrome/Brave/Firefox only; QuickTime and Safari
  will not open it. Kept because `scripts/record-backup.mjs` regenerates it; convert with
  `ffmpeg -i backup-demo.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart backup-demo.mp4`.

Both exist and pass preflight. If you want a
hand-recorded version instead, follow the shot list below with the presenter — **⌘⇧5 → "Record Selected
Portion"**, draw the box around the browser, no audio. You narrate over it live. Target ~75 s.

Before pressing record:
```bash
npm run seed && npm run dev          # fresh data, server up
```
Browser at `http://localhost:3000/#try`, zoom 110%, window ~1440×900, no other tabs visible.

| t | Shot | Hold |
|---|---|---|
| 0:00 | Dashboard, clean state. Cursor over the **Demo mode · seeded data** badge. | 3 s |
| 0:03 | Click **Run audit**. Do not move the mouse — let the log build. It takes ~9 s; all four Classifier flags, the Forecast line, then four Negotiator drafts with two **escalate_for_approval** lines. | 10 s |
| 0:13 | Scroll the action log so one `escalate_for_approval` line is centred (it names the $1,000/mo threshold). | 4 s |
| 0:17 | Click the **Twilio** flag card to expand it. The feature bars (4.00× category mean) are the explainability shot. | 6 s |
| 0:23 | Scroll to the **approval queue**. Two held drafts. Open **Twilio**; show the email body and `billing@twilio.com`. | 6 s |
| 0:29 | Click **Approve**. Status flips; if Mailtrap is configured, switch to the Mailtrap tab and show the message in the inbox, then back. | 8 s |
| 0:37 | Scroll to the **cash-horizon chart**: three scenario lines, band, 9.4 → 10.1 mo. | 5 s |
| 0:42 | Type **"why did you flag Segment?"** in *Ask the agent* and submit. Let the answer render. | 8 s |
| 0:50 | Click **Investor update →**. Hold on the slide. | 6 s |
| 0:56 | ⌘P, show the print preview for 2 s, Esc. End on the slide. | 4 s |

Stop recording. Save as `docs/backup-demo.mp4` (or `.webm`/`.gif`/`.mov`), commit it, then run
`npx tsx scripts/preflight.ts` — it checks the file exists.

Re-record if the dashboard changes materially. One take is fine; the data is deterministic, so a
second take looks identical to the first.

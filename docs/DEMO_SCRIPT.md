# Runway Radar — Demo Script & Judging Checklist

Five minutes. One click path. Every number below comes from the seeded dataset and
is byte-identical on every run in demo mode, so what you rehearse is what judges see.

## T-minus 10 minutes (do all of these, in order)

```bash
cat .env.local | grep DEMO_MODE        # must be unset or "true" on stage
npm run seed                           # fresh DB: 12 vendors, 6 periods, 0 flags
npm run smoke                          # asserts the 4 planted anomalies get caught
npm run dev                            # local, not hosted — no cold starts
open http://localhost:3000/dashboard
```

If `npm run smoke` fails: **do not debug live.** Play the backup recording.

Also: laptop on power, notifications off, browser zoom 110%, backup video open in a second tab.

## The click path (≈4 min)

1. **Landing → Dashboard** (10s)
   "Most startups don't die from one big mistake. They die from slow leakage nobody audits
   until it's too late. Runway Radar is an agent that watches vendor spend continuously and
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
   - Negotiator looks up each billing contact, then drafts — "two tool calls, not one."

4. **Expand one flag card → feature breakdown** (30s)
   "This is the explainability layer. Each flag is a linear score whose per-feature
   contributions are the exact Shapley decomposition — so 'why did it fire' is answerable
   with numbers, not a paragraph from a language model."

5. **Approval queue** (40s)
   Two drafts are held because their impact exceeds $1,000/mo.
   "The agent drafts, it does not send. Anything above threshold stops here."
   Approve **Twilio**. The email lands in the Mailtrap sandbox inbox — show it if there's time.
   "No code path in this app can reach a real vendor's mailbox. That's deliberate."

6. **Runway chart** (20s)
   "Acting on all four moves runway from 9.4 to 10.1 months — $76,620 a year recovered
   from tools nobody was looking at."

7. **Closer: /investor-update** (30s)
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
| Runway | 9.4 → 10.1 months (+0.7) |
| Held for approval | 2 of 4 drafts |

## Likely judge questions

**"Is this live or scripted?"**
Demo mode against seeded data, deliberately, so the showcase is deterministic. The live path
(`DEMO_MODE=false`, Plaid sandbox + Stripe test keys, `POST /api/sync`) feeds the same tables
and the same agents. Offer to show it.

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

## Backup recording

Record the full click path once at hour ~21 with `npm run seed` fresh. 1080p, no audio —
you narrate over it live exactly as above. Keep it open in a second tab during judging.

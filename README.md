# Runway Radar

Agentic cash-burn auditor and vendor renegotiation copilot for early-stage startups.

Most startups do not fail from one dramatic mistake. They fail from slow, quiet
cash leakage nobody is watching closely enough to catch, and by the time someone
audits vendor spend it is often too late to matter. Runway Radar watches
continuously and escalates only the decisions that actually need a human.

## Quick start

```bash
npm install      # run this again after every git pull — dependencies change
npm run dev      # http://localhost:3000
```

An empty database is seeded automatically on first open (6 billing periods of
spend with four anomalies planted in it). `npm run seed` resets it to the same
bytes at any time; so does the **Reseed** button on the dashboard.

Open the home page, switch to **Agent dashboard** (or click **Try Runway** in the nav) and press **Run audit**.

No API keys are needed. `DEMO_MODE` defaults to on, so the whole product runs
locally with no network calls and no cost.

```bash
npm run smoke    # 52 assertions — run this before demoing
```

## Try it on your own data

Click **Try Runway** in the nav and drop a **CSV or JSON** export of vendor spend on the
**Your data** panel (any spreadsheet saved as CSV works — bank, Brex, Ramp,
QuickBooks). The seeded data is replaced and **Run audit** runs the agents on
yours. `/sample-spend.csv` is a ready-made spreadsheet with the four anomalies
planted, for editing rather than starting from scratch.

One row per vendor per billing period. Columns (aliases accepted):

| Column | Required | Used by |
|---|---|---|
| `vendor` (merchant, name, payee) | yes | everything |
| `amount` (cost, total, spend) | yes | everything — `$1,200.00` is fine |
| `date` (period, month) | yes | `2026-01-15`, `01/15/2026`, `Jan 2026` all bucket to the month |
| `category` | no | overpriced detector (peers) |
| `seats`, `active_seats` | no | usage-drift detector |
| `function_tag` | no | duplicate detector (guessed from the vendor name if absent) |
| `contract_terms`, `contact_email` | no | negotiator |

A full workspace export also works — `{ "workspace": {...}, "vendors": [...],
"transactions": [...] }`. Transactions are the spend; the `vendors` table
fills in category, contract terms, contact email and seats (`"20 seats"` inside
free-text terms is picked up); `workspace.name` becomes the company name.
Any `agent_actions` / `forecast_snapshots` keys are ignored — those are agent
output, and the agents regenerate them from the raw spend.

Or `POST /api/import` with `multipart/form-data` (`file=`) or a JSON array of rows.

## How it works

Four agents, each with a narrow job, coordinated by a fifth.

| Agent | Job |
|---|---|
| **Classifier** | Finds wasteful spend. Four detectors, scored by a linear model. |
| **Forecast** | Burn and runway across three scenarios, with a Monte Carlo band. |
| **Negotiator** | Resolves a billing contact, then drafts the ask. Never sends. |
| **Orchestrator** | Sequences the others, logs reasoning, enforces the approval threshold. |

### Detection is deterministic; only the prose is generated

This is the central design decision. Every flag comes from arithmetic over the
transaction history — never from a language model's opinion. The LLM writes the
narration and the negotiation emails, nothing else.

Two things follow from that. The demo cannot fail because an API is slow or
rate-limited. And "why did it flag that?" has an exact answer instead of a
plausible-sounding one.

### The four detectors

| Detector | Fires when |
|---|---|
| `overpriced` | Cost is ≥1.8× the mean of category peers, unmitigated by utilisation |
| `duplicate` | Two vendors share a *function tag* and their combined active seats exceed headcount |
| `usage_drift` | Seat utilisation under 40% on a provisioned tier |
| `price_creep` | ≥35% growth across billing periods, monotonic, with no plan change |
| `billing_spike` | One period ≥2× the vendor's median invoice, then back to normal — a one-off overage to query |

Duplicate detection groups on `functionTag`, not billing category. "Productivity"
covers both a wiki and an issue tracker, and nobody cancels one to keep the
other. Notion and Confluence share `knowledge_base`; Linear does not.

### Explainability

Each detector scores with a small linear model:

```
score = sigmoid( bias + Σ wᵢ · (xᵢ − baselineᵢ) )
```

For a linear model the Shapley value of feature *i* is exactly
`wᵢ · (xᵢ − baselineᵢ)`. So the per-feature contributions shown in the UI are not
an approximation of feature importance — they are the exact decomposition of the
score. Expand any flag on the dashboard to see it.

This is deliberately *not* a from-scratch SHAP pipeline over a trained model.
That takes real setup time; this gives an honest, defensible answer in code you
can read in one sitting.

### Human approval

Any action whose estimated impact exceeds `APPROVAL_THRESHOLD` (default $1,000/mo)
is drafted and **held**. The agent stops. On the seeded data that means Twilio
($3,200/mo) and Segment ($2,080/mo) wait for a person; Datadog ($685) and
Confluence ($420) clear automatically.

An agent that knows when *not* to act is the more interesting story than one
that always acts. It is also a policy choice, not a solved safety problem — say
that plainly if a judge pushes on it. A real deployment would need much stronger
guardrails before anything reached a vendor unsupervised.

## Email safety

There is no code path from this build to a real vendor's inbox, and the guard is
in code rather than in discipline. `lib/mailer.ts` refuses any SMTP host that is
not a known sandbox — pointing `SMTP_HOST` at SendGrid does not enable
production sending, it throws. The smoke test asserts this.

To watch drafts land in an inbox, point the `SMTP_*` vars at a
[Mailtrap](https://mailtrap.io) sandbox.

## Demo mode

`DEMO_MODE` is **opt-out**, not opt-in — it is on unless you explicitly set
`DEMO_MODE=false`. With it on, no agent makes a network call, and the seed PRNG
is fixed, so every run produces byte-identical data and the same four findings.
Your showcase never depends on venue wifi or on a free-tier endpoint that every
other team is hammering.

If a judge asks whether what they are seeing is live: tell them the truth. It is
running deterministically against seeded data so the showcase is reliable, and
the live sandbox integration works underneath it, which you can show on request.

**Live path:** set `DEMO_MODE=false`, add Plaid sandbox and Stripe test keys,
`POST /api/sync`, then run the audit — same agents, same tables.

## Routes

| Route | What it is |
|---|---|
| `/` | Overview, reading live numbers from the database |
| `/#try` (home, agent view) | The product: findings, projection, approvals, action log |
| `/investor-update` | Auto-generated 16:9 investor slide (⌘P → PDF) |
| `POST /api/audit` | Runs the audit, streams events as SSE |
| `GET /api/state` | Everything the dashboard renders, in one round trip |
| `POST /api/approve` | Records a human decision on a held draft |
| `POST /api/sync` | Pulls Plaid sandbox + Stripe test data (409 in demo mode) |
| `POST /api/reset` | Reseeds |

## Data model

SQLite (`runway.db`, created on first run). Five tables: `vendors`,
`transactions`, `agent_actions`, `forecast_snapshots`, `drafts`.

`agent_actions` is the one that matters for a demo. Judges will ask why the agent
did something, and a visible log with reasoning text is what separates a real
agent from a scripted one.

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional — the defaults run
the full product offline.

## Before you present

Read `docs/DEMO_SCRIPT.md`. Run `npm run smoke` immediately before your slot; if
it fails, switch to the recorded backup video rather than debugging live.

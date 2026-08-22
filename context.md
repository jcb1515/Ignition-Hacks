# Runway Radar: 24 Hour Build Plan

## Overview

Runway Radar is an agentic cash burn auditor and vendor renegotiation copilot for early-stage startups. It watches transactions continuously, flags wasteful or anomalous vendor spend, drafts renegotiation or cancellation emails, and projects financial runway across multiple scenarios. The goal is to catch the slow, quiet cash leakage that kills most startups before it becomes fatal.

Most startups do not fail from one dramatic mistake. They fail from slow, quiet cash leakage that nobody watches closely enough to catch. By the time a human audits vendor spend, it is often too late to matter. Runway Radar is an agent that watches continuously and only escalates the decisions that actually need a human. That is a genuinely different value proposition than a dashboard someone has to remember to check.

## Complexity philosophy

This plan has three tiers. Tier 1 is the MVP and must work by hour twelve. If nothing else survives, this alone is a demoable product. Tier 2 is the target build, completed between hour twelve and hour twenty. Tier 3 is stretch work, only touched if Tier 2 is done early and stable. Do not start Tier 3 work while Tier 2 has open bugs. That is how projects collapse at hour twenty three.

## Team assumption

Four to five people. Roles are labeled below; adjust if your team size differs.

- One person owns the Base44 shell.
- One person owns the agent backend.
- One person owns data seeding.
- One person owns frontend polish and demo prep.
- If you have five people, the fifth floats between agent backend and demo prep.

## Tech stack

### Shell and hosting

Base44 for the dashboard shell, auth, database schema, and hosting. Let it do exactly this and nothing more. Do not try to force the agent orchestration logic into Base44's generated code. That fights the tool.

### Data sources

- Plaid sandbox for bank transactions.
- Stripe test mode for subscription and revenue data.

Both have hackathon-friendly sandbox environments with pre-seeded fake accounts. Use them. Do not waste hours trying to connect a real bank.

### Agent orchestration

A separate backend service, not inside Base44. Python with a simple custom agent loop or LangGraph if someone on the team already knows it. Do not learn a new orchestration framework during the hackathon. Use whatever the most experienced person on your team already knows cold.

### LLM

Claude or GPT with function calling for tool use. Pick whichever your team has existing API familiarity with. This is not the place to experiment.

### Optional voice layer

If someone on your team has a reusable voice pipeline, faster whisper for speech to text, an LLM for intent parsing, and an existing text to speech setup, wire it in as a stretch feature so a judge can literally ask the agent a question out loud. This is Tier 3, only if Tier 2 is solid.

### Pitch deck generation

Canva MCP, if connected, to have the agent generate a live investor update slide from its own output. This is the single highest impact stretch feature for judge reaction. It makes the demo end on something visually strong instead of a terminal log.

## Data model, minimum viable

Four tables in Base44's database.

### Vendors

- name
- category
- monthly cost
- contract terms
- last contact date
- contact email

### Transactions

- vendor_id
- amount
- date
- source (Plaid or Stripe)
- flagged (boolean)

### AgentActions

- timestamp
- agent_name
- action_type
- target_vendor
- reasoning_text
- human_approved (boolean)
- dollar_impact

The AgentActions table is not optional. Judges will ask why the agent did something, and a visible action log with reasoning is what separates a real agent demo from a scripted fake one.

### ForecastSnapshots

- date
- current_burn_rate
- current_runway_in_months
- scenario_label

## Agent architecture

Four agents, each with a narrow job. Do not build one giant agent that tries to do everything. That is harder to debug and harder to explain on stage.

### Classifier Agent

Reads transactions, flags duplicate subscriptions, flags spend anomalies against category norms, and assigns a confidence score to each flag.

### Negotiator Agent

Given a flagged vendor, drafts a renegotiation or cancellation email. It does not send anything above a dollar threshold without human approval. That threshold logic is itself a demo talking point about responsible agent design.

### Forecast Agent

Runs a burn rate projection. At minimum, a linear model. Ideally, a simple Monte Carlo across a few burn scenarios: current, aggressive cut, hiring freeze.

### Orchestrator Agent

Decides which of the above to invoke and in what order. It maintains the action log and enforces the approval threshold. This is the piece that makes it look autonomous rather than a chain of manual button presses.

## Stretch: explainability layer

If you want a real complexity flex that is also genuinely defensible under judge questioning, add a lightweight explainability layer on the Classifier Agent. This is a short feature-importance style breakdown of why a transaction was flagged, similar in spirit to SHAP output. This is Tier 3, only after the core loop is bulletproof.

## Hour by hour

### Hour 0 to 1: Setup

- Repo created.
- API keys pulled for Plaid sandbox, Stripe test mode, and your LLM provider.
- Roles assigned.

### Hour 1 to 3: Scaffold

- Base44 shell built.
- Four tables created.
- Auth working.
- Basic dashboard skeleton with placeholder data visible.
- In parallel, agent backend repo initialized with a bare Claude or GPT call working end to end. No tools yet. Just confirm the API key and basic call chain work.

### Hour 3 to 6: Data seeding

This step gets skipped by teams that then wonder why their demo looks boring. Plaid sandbox data is clean and will not surface anomalies on its own. Write a seed script that injects deliberate duplicate subscriptions, one obviously overpriced vendor, and a realistic burn trend. This seed data is what makes hour twenty look impressive instead of flat.

### Hour 6 to 10: Core agent logic

Classifier Agent working against seeded transactions, correctly flagging the planted anomalies. This is your Tier 1 checkpoint gate. Do not move forward until this works reliably on the seed data, not just once by luck.

### Hour 10 to 12: MVP lock

- Negotiator Agent drafts a plausible email for one flagged vendor.
- Forecast Agent produces a basic runway number.
- Orchestrator wires the three together in a single click flow from the dashboard.

Tier 1 is now complete and demoable even if everything else falls apart from here.

### Hour 12 to 16: Target build

- Approval threshold logic added to the Orchestrator.
- Action log populated and visible in the dashboard with reasoning text, not just outcomes.
- Forecast Agent upgraded from a single line projection to at least two or three scenarios.
- Frontend polish pass. This is where Base44's visual editor earns its keep.

### Hour 16 to 18: Integration testing

Full flow run start to finish, at least five times, by someone who did not write the code. Bugs found here get fixed here, not at hour twenty three. If the voice layer or Canva deck generation is being attempted, this is when it gets wired in, not later.

### Hour 18 to 20: Stretch window

Only enter this window if Tier 2 has zero open bugs. If Tier 2 is shaky, spend this time hardening it instead. If Tier 2 is solid, this is when the explainability layer, the voice query interface, or the Canva auto-generated pitch slide gets attempted.

### Hour 20 to 22: Demo script

Write the actual spoken narrative for the pitch. Decide exactly which flagged vendor you will show live, script the click path, and have a backup recorded video of the full flow in case live wifi or an API sandbox has an outage during judging. This backup video is not optional. Sandbox APIs going down mid-pitch is common, and it is the single most avoidable failure mode.

### Hour 22 to 24: Rehearsal and buffer

Full run-through at least twice with the actual presenter. Fix nothing structural at this point, only wording and timing. Sleep is not scheduled here on purpose, but if your team is falling apart, a working Tier 1 with a clean five minute demo beats a broken Tier 3 every time. Keep that trade-off in mind as the clock runs out.

## Maximum realistic complexity ceiling

You asked for maximum complexity that is still realistic. The honest ceiling is determined by reuse. Anything your team has already built before this hackathon can be wired in fast. Anything you would be building from zero inside these 24 hours cannot be as ambitious, no matter how much AI-assisted coding speeds up the typing, because the bottleneck stops being code and becomes debugging and integration. That does not compress the same way.

### Ranked additions

Attempt these in order. Each one only gets attempted if the one above it is done and stable.

1. **Human approval threshold on the Orchestrator.** Already in Tier 2. This alone is a real complexity signal to judges. An agent that knows when not to act autonomously is a more sophisticated story than one that always acts.
2. **Multi-scenario Monte Carlo forecasting instead of a single line projection.** This is just math. A few burn scenarios run through the same model with varied assumptions. Cheap to build, meaningfully more impressive than one number.
3. **Reused explainability layer, not a from-scratch one.** If your team has an existing SHAP-based feature importance pipeline from prior work, comparing models like Logistic Regression, XGBoost, or similar, reuse that pipeline against the transaction classifier instead of building explainability logic new. Building real SHAP output from zero in this window is not realistic. A trained model and a working SHAP pipeline take real setup time you do not have. Wiring in an existing one takes an afternoon. That is the difference between realistic and not.
4. **Reused voice query interface.** If your team already has a working speech-to-text and text-to-speech pipeline from a prior project, wiring it in so a judge can ask the agent a question out loud is high impact and genuinely fast to integrate. The hard parts, audio capture, model latency tuning, and voice selection, are already solved. Building a voice pipeline from scratch during the hackathon is not on this list for a reason. That alone can eat six or more hours if audio latency or interruption handling goes wrong, and it is not the differentiator here.
5. **Live status updates over websockets instead of polling or manual refresh.** If someone on the team has done this before, a real-time feed of the agent's reasoning as it works is a strong visual during the demo. If nobody has done this before, skip it. This is exactly the kind of thing that looks small and eats three hours on debugging a race condition at 2 a.m.
6. **A real second API for the Negotiator Agent to call, beyond the LLM itself.** A vendor contact lookup, using a web search tool call or a simple lookup API, so the agent is not just drafting emails to a hardcoded address but genuinely finding where to send them. This is a legitimate agentic complexity add because it is a second real tool call in the chain, not just a second LLM prompt, and it directly answers the original brief about agentic API work.
7. **Canva auto-generated investor update slide, produced live from the agent's own output.** Save this for last. It is the best demo closer, but it is also the most cosmetic addition on this list. It does not add real system complexity; it adds narrative punch. Worth doing only after everything above is stable.

## What is explicitly off the table, and why

- **Do not attempt fine-tuning any model.** There is no realistic path to a useful fine tune in this window. Prompting and tool calling gets you further faster.
- **Do not attempt real production-grade multi-tenant authentication or a genuine security review.** That is weeks of work condensed into a demo that does not need it. A single-tenant Base44 auth flow is entirely sufficient for judging.
- **Do not attempt live email sending to real vendor addresses under any circumstances.** Covered already, but worth repeating because under pressure at hour twenty someone will be tempted to just flip it on for the demo.
- **Do not attempt building a custom agent orchestration framework instead of a simple loop.** A homemade version of LangGraph built during the hackathon is a classic way to burn six hours proving a concept you already know works.

## The honest summary

The ceiling is not how many features you can list. It is how many of the ranked list above your team can genuinely reuse rather than build fresh. If two people on your team have real prior work in explainability or voice, your realistic ceiling includes items three and four. If nobody does, your realistic ceiling stops at item two, and that is still a strong, defensible project. It just is not going to look like a research paper on stage, and that is fine.

## Testing and demo setup, zero cost

Nothing in this stack needs a paid account if you set it up correctly.

### Plaid

Use Plaid's Sandbox environment only, never Development or Production. Sandbox is free with no meaningful limits for a hackathon, and it ships with fake test institutions you can link with canned credentials straight from their docs. No real bank account, no cost, no waiting on approval.

### Stripe

Use Stripe's test mode exclusively. Secret key starts with `sk_test`, publishable key starts with `pk_test`. Test mode never touches real money, and Stripe provides standard test card numbers for simulating subscriptions and charges. The only way this costs anything is if someone accidentally swaps in live keys, so check that before every rehearsal.

### Email sending

Do not wire the Negotiator Agent to a real SendGrid or Twilio account for this. Both cost money past free tiers, and worse, if your seed data has a real-looking vendor email, you risk actually sending something out. Use Mailtrap instead, a fake SMTP sandbox built exactly for this. Every email your app sends gets caught in a private testing inbox only your team can see. Nothing reaches a real address, and the free tier covers far more volume than a hackathon needs. This also lets you show a judge an actual drafted email sitting in an inbox, which reads as more convincing than a JSON blob on a screen.

### LLM API costs

Your provider will have a free trial credit or a very cheap per-token rate. Protect it by testing your agent logic on a single hardcoded transaction while debugging, not by looping the full agent chain over and over. Run the full seed set only a handful of times during build. Keep a small reserved buffer of unused budget specifically for the live judging run so you never risk a rate limit or a spent credit ceiling mid-pitch.

### Hosting

Run it locally on a laptop for judging if you can. That is genuinely zero cost and removes any dependency on a free hosting tier having a cold start delay or an outage during your five minute window. If you do host it, Vercel and Render free tiers are sufficient, but local avoids the single most common live demo failure: a cold start right when a judge is watching.

### Canva

Free tier covers hackathon-scale design generation through the connector. No cost concern.

### The actual test harness

Before judging, run a scripted smoke test, not a manual click-through. A short script that seeds the four tables fresh, runs the Classifier Agent against them, and asserts the deliberately planted anomalies get flagged. Run this once right before your judging slot. If it fails, fall back to the recorded video immediately instead of debugging live.

### Demo mode toggle

Build a single environment flag, something like `DEMO_MODE=true`, that when set points every agent at the seeded local data instead of making live calls to Plaid or Stripe. Your showcase to judges then never depends on a sandbox API being reachable, on venue wifi, or on rate limits from every other team hammering the same free tier endpoint at the same time. Judges see the exact same flagged anomalies and the exact same drafted email every single time, deterministically, and it costs nothing to run because nothing external gets called during the live demo. This is standard practice, not a shortcut. Plenty of real products ship with a staging or demo mode for exactly this reason.

If a judge asks whether what they are seeing is live or seeded, tell them the truth. Say it is running in a deterministic demo mode against seeded sandbox data so the showcase is reliable, and that the live Plaid and Stripe sandbox integration is working underneath it, which you can show if they want to see it. Judges trust a team more when they are upfront about what is scripted versus what is genuinely wired end to end. Pretending otherwise if pressed is a worse outcome than just saying so.

## What to say when a judge asks why this matters

The honest answer is that most startups do not fail from one dramatic mistake. They fail from slow, quiet cash leakage nobody is watching closely enough to catch, and by the time a human finally audits vendor spend it is often too late to matter. An agent that watches continuously and only escalates the decisions that actually need a human is a genuinely different value proposition than a dashboard someone has to remember to check.

## Known risks to say out loud if pushed

The approval threshold logic is a policy choice, not a solved problem, and a real deployment would need much stronger guardrails before an agent sends anything to a real vendor unsupervised. Say this plainly if asked. Do not pretend the safety story is more finished than it is. Judges respect that more than overclaiming.

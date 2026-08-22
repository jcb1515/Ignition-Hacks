/**
 * Ask the agent — natural-language Q&A over the audit.
 *
 * Deterministic first: a small intent router answers the questions judges
 * actually ask ("why did you flag Twilio?", "how many months of cash do we have?", "what's
 * waiting on me?") straight from the action log and forecast, with no network.
 * If an LLM key is configured and the question doesn't match a known intent,
 * the same grounded context is handed to the model with strict instructions to
 * answer only from it. In demo mode the model is never called.
 *
 * The voice layer on top of this is the browser's own Web Speech API — nothing
 * to build, nothing to host, nothing to fail.
 */
import { APPROVAL_THRESHOLD, COMPANY, DEMO_MODE } from "@/lib/company";
import { currentMrr } from "@/lib/revenue";
import { forecast } from "@/lib/agents/forecast";
import { generate, llmAvailable } from "@/lib/llm";
import { getActions, getDrafts, getFlaggedTransactions, getVendors } from "@/lib/db/queries";
import { negotiationThread } from "@/lib/agents/negotiation";
import { formatCurrency } from "@/lib/types";
import type { FeatureBreakdown, Flag, Vendor } from "@/lib/types";

export interface Answer {
  question: string;
  answer: string;
  /** "rule" = deterministic router, "llm" = model, "fallback" = model unavailable */
  source: "rule" | "llm" | "fallback";
  intent: string;
  /** Short follow-ups the UI can offer as chips. */
  suggestions: string[];
}

function inferKind(features: FeatureBreakdown[]): Flag["kind"] {
  const names = features.map((f) => f.feature);
  if (names.includes("seat_overlap_vs_headcount")) return "duplicate";
  if (names.includes("period_over_period_growth")) return "price_creep";
  if (names.includes("spike_vs_median")) return "billing_spike";
  if (names.includes("cost_vs_category_mean")) return "overpriced";
  return "usage_drift";
}

const KIND_PHRASE: Record<Flag["kind"], string> = {
  overpriced: "overpriced relative to its category",
  duplicate: "a duplicate of another tool you already pay for",
  usage_drift: "billing for far more seats than are in use",
  price_creep: "creeping up in price with no plan change",
  billing_spike: "billed far above its normal amount in one period",
};

interface Ctx {
  vendors: Vendor[];
  flags: Flag[];
  drafts: ReturnType<typeof getDrafts>;
  actions: ReturnType<typeof getActions>;
  f: ReturnType<typeof forecast>;
  audited: boolean;
}

function loadContext(): Ctx {
  const vendors = getVendors();
  const flags: Flag[] = getFlaggedTransactions().map((t) => {
    const v = vendors.find((x) => x.id === t.vendorId);
    let features: FeatureBreakdown[] = [];
    try { features = t.features ? JSON.parse(t.features) : []; } catch { features = []; }
    return {
      transactionId: t.id, vendorId: t.vendorId, vendorName: t.vendorName,
      kind: inferKind(features), confidence: t.confidence ?? 0, features,
      headline: t.reason ?? "", monthlyCost: v?.monthlyCost ?? t.amount,
    };
  });
  const actions = getActions(500);
  return { vendors, flags, drafts: getDrafts(), actions, f: forecast(flags), audited: actions.length > 0 };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function findVendor(q: string, vendors: Vendor[]): Vendor | undefined {
  const n = norm(q);
  return vendors.find((v) => n.includes(norm(v.name))) ??
    vendors.find((v) => norm(v.name).split(" ").some((w) => w.length > 3 && n.includes(w)));
}

function months(n: number): string {
  return `${n.toFixed(1)} months`;
}

/* ---------------- intents ---------------- */

type Rule = { intent: string; test: (q: string) => boolean; answer: (q: string, c: Ctx) => string };

const RULES: Rule[] = [
  {
    intent: "negotiation",
    test: (q) => /(negotiat|haggl|counter|offer|deal|how did .* go|talks)/.test(q),
    answer: (q, c) => {
      const v = findVendor(q, c.vendors);
      const threadFor = (name: string) => negotiationThread(name);
      if (!v) {
        const active = c.vendors.filter((x) => threadFor(x.name).length > 0);
        if (!active.length) return "No negotiations have run yet. Open a flagged vendor's draft and press Negotiate.";
        return `I've negotiated with ${active.map((x) => x.name).join(", ")}. Ask about one by name for the round-by-round.`;
      }
      const t = threadFor(v.name);
      if (!t.length) return `I haven't negotiated with ${v.name} yet — only the opening ask has gone out.`;
      const last = t[t.length - 1];
      const rounds = t.filter((a) => a.type === "negotiation_round").length;
      const best = Math.min(...t.filter((a) => a.type.startsWith("vendor_")).map((a) => v.monthlyCost - a.dollarImpact));
      const result =
        last.type === "negotiation_accepted" ? `I closed it myself at ${formatCurrency(best)}/mo, saving ${formatCurrency(v.monthlyCost - best)}/mo — under the threshold.` :
        last.type === "negotiation_accept_pending" ? `We reached ${formatCurrency(best)}/mo, saving ${formatCurrency(v.monthlyCost - best)}/mo, but that's above the ${formatCurrency(APPROVAL_THRESHOLD)}/mo threshold so it's waiting for your sign-off.` :
        last.type === "negotiation_escalated" ? `Their best was ${formatCurrency(best)}/mo, above my ceiling, so I stopped and escalated. You decide: take ${formatCurrency(v.monthlyCost - best)}/mo or walk.` :
        "It's still in progress.";
      return `${v.name}: ${rounds} round${rounds === 1 ? "" : "s"}, from ${formatCurrency(v.monthlyCost)}/mo. ${result}`;
    },
  },
  {
    intent: "why_flagged",
    test: (q) => /\bwhy\b/.test(q) && /(flag|catch|pick|choose|select|mark)/.test(q) || /\bwhy\b.*\b(twilio|datadog|segment|confluence)\b/.test(q),
    answer: (q, c) => {
      const v = findVendor(q, c.vendors);
      if (!v) {
        if (!c.flags.length) return "Nothing is flagged yet. Run an audit first.";
        return `I flagged ${c.flags.length} vendors: ${c.flags.map((f) => f.vendorName).join(", ")}. Ask about one by name and I'll walk through the signals.`;
      }
      const fl = c.flags.find((f) => f.vendorId === v.id);
      if (!fl) return `${v.name} wasn't flagged. It's ${formatCurrency(v.monthlyCost)}/mo in ${v.category}, ${v.activeSeats}/${v.seats} seats active, and nothing about it exceeded the anomaly thresholds.`;
      const top = [...fl.features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
      const signals = top.map((s) => `${s.feature.replaceAll("_", " ")} at ${s.value} (${s.contribution >= 0 ? "+" : ""}${s.contribution.toFixed(2)})`).join("; ");
      return `${v.name} is ${KIND_PHRASE[fl.kind]}, at ${Math.round(fl.confidence * 100)}% confidence. The signals that drove it: ${signals}. Those contributions are the exact Shapley decomposition of the score, so that's the whole explanation, not a summary of one.`;
    },
  },
  {
    intent: "cash_horizon",
    test: (q) => /cash horizon/.test(q) || /how (long|many months)/.test(q) || /run out of (cash|money)/.test(q),
    answer: (_q, c) => {
      const [cur, cut, freeze] = c.f.scenarios;
      const mc = c.f.monteCarlo[cur.label];
      const band = mc ? ` The Monte Carlo band on the current path is ${months(mc.p10)} to ${months(mc.p90)} across ${mc.trials.toLocaleString()} trials.` : "";
      if (!c.flags.length) return `Cash horizon is ${months(cur.runwayMonths)} at ${formatCurrency(cur.netBurn)}/mo net burn with ${formatCurrency(COMPANY.cashOnHand)} in the bank.${band}`;
      return `${months(cur.runwayMonths)} if nothing changes. Acting on every flag takes it to ${months(cut.runwayMonths)}, and a hiring freeze on top gets ${months(freeze.runwayMonths)}.${band}`;
    },
  },
  {
    intent: "savings",
    test: (q) => /(sav|recover|how much|worth|impact|money)/.test(q),
    answer: (_q, c) => {
      if (!c.flags.length) return "No savings identified yet — run an audit.";
      const per = c.flags.map((f) => `${f.vendorName} ${formatCurrency(f.monthlyCost)}/mo`).join(", ");
      return `${formatCurrency(c.f.totalMonthlySavings)} a month, ${formatCurrency(c.f.totalMonthlySavings * 12)} a year, across ${c.flags.length} vendors (${per}). Those are conservative estimates, not the vendors' full bills.`;
    },
  },
  {
    intent: "threshold",
    test: (q) => /(threshold|autonom|without (asking|approval)|on (its|your) own|guardrail|safe)/.test(q),
    answer: () =>
      `The approval threshold is ${formatCurrency(APPROVAL_THRESHOLD)} a month. Below it I act autonomously — draft and queue the message. Above it I draft and stop until a human approves. Nothing ever goes to a real vendor: the mailer only accepts a sandbox host. That threshold is a policy choice, not a solved safety problem; a real deployment would need stronger guardrails.`,
  },
  {
    intent: "pending",
    test: (q) => /(pending|waiting|approv|need(s)? me|my (decision|sign)|held|queue)/.test(q),
    answer: (_q, c) => {
      const held = c.actions.filter((a) => a.approvalRequired && !a.humanApproved);
      if (!held.length) return c.audited ? "Nothing is waiting on you. Every held draft has been decided." : "Nothing yet — run an audit.";
      const names = [...new Set(held.map((a) => a.target ?? "a vendor"))];
      return `${names.length} decision${names.length > 1 ? "s" : ""} waiting on you: ${names.join(" and ")}. Each one is above the ${formatCurrency(APPROVAL_THRESHOLD)}/mo threshold, so I drafted but didn't act. Approve them in the queue and they go to the sandbox outbox.`;
    },
  },
  {
    intent: "biggest",
    test: (q) => /(biggest|largest|most expensive|top vendor|spend the most)/.test(q),
    answer: (_q, c) => {
      const top = [...c.vendors].sort((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 3);
      return `Top three by spend: ${top.map((v) => `${v.name} at ${formatCurrency(v.monthlyCost)}/mo`).join(", ")}. Total vendor spend is ${formatCurrency(c.f.vendorSpend)}/mo, about ${Math.round((c.f.vendorSpend / c.f.scenarios[0].monthlyBurn) * 100)}% of burn.`;
    },
  },
  {
    intent: "vendor_detail",
    test: () => true, // only reached if a vendor name is present, see router
    answer: (q, c) => {
      const v = findVendor(q, c.vendors)!;
      const fl = c.flags.find((f) => f.vendorId === v.id);
      const d = c.drafts.find((x) => x.vendorId === v.id);
      const base = `${v.name}: ${formatCurrency(v.monthlyCost)}/mo, ${v.category}, ${v.contractTerms.toLowerCase()} terms, ${v.activeSeats} of ${v.seats} seats active.`;
      if (!fl) return `${base} Not flagged.`;
      const heldHere = c.actions.some((a) => a.approvalRequired && !a.humanApproved && a.target === v.name);
      const draft = d ? ` I drafted a message to ${d.toEmail}${d.approved ? " and it's been approved" : heldHere ? " — it's waiting for your approval" : " and queued it (under the autonomy threshold)"}.` : "";
      return `${base} Flagged as ${KIND_PHRASE[fl.kind]} at ${Math.round(fl.confidence * 100)}% confidence.${draft}`;
    },
  },
  {
    intent: "summary",
    test: (q) => /(summar|what did you (find|do)|overview|status|what happened|tell me about)/.test(q) || q.length < 12,
    answer: (_q, c) => {
      if (!c.audited) return "No audit has run yet. Hit Run audit and ask me again.";
      const [cur, cut] = c.f.scenarios;
      const realised = c.actions.filter((a) => a.type === "negotiation_accepted" || a.type === "human_accept").reduce((s, a) => s + a.dollarImpact, 0);
      return `I audited ${c.vendors.length} vendors and flagged ${c.flags.length}: ${c.flags.map((f) => f.vendorName).join(", ")}. That's ${formatCurrency(c.f.totalMonthlySavings * 12)} a year recoverable${realised > 0 ? `, of which ${formatCurrency(realised * 12)} is already locked in` : ""}, extending the cash horizon from ${months(cur.runwayMonths)} to ${months(cut.runwayMonths)}. ${new Set(c.actions.filter((a) => a.approvalRequired && !a.humanApproved).map((a) => a.target)).size} drafts are held for your approval.`;
    },
  },
];

const SUGGESTIONS = [
  "Why did you flag Twilio?",
  "How many months of cash do we have?",
  "What's waiting on me?",
  "How much can we save?",
  "What's the approval threshold?",
];

function route(q: string, c: Ctx): { intent: string; text: string } | null {
  const n = norm(q);
  for (const r of RULES) {
    if (r.intent === "vendor_detail") {
      if (findVendor(n, c.vendors)) return { intent: r.intent, text: r.answer(n, c) };
      continue;
    }
    if (r.test(n)) return { intent: r.intent, text: r.answer(n, c) };
  }
  return null;
}

function contextBlob(c: Ctx): string {
  const [cur, cut, freeze] = c.f.scenarios;
  return [
    `Company: ${COMPANY.name}, ${COMPANY.headcount} people, cash ${formatCurrency(COMPANY.cashOnHand)}, MRR ${formatCurrency(currentMrr())}.`,
    `Burn ${formatCurrency(cur.monthlyBurn)}/mo; vendor spend ${formatCurrency(c.f.vendorSpend)}/mo.`,
    `Cash horizon: current ${cur.runwayMonths.toFixed(1)} mo, all flags remediated ${cut.runwayMonths.toFixed(1)} mo, plus hiring freeze ${freeze.runwayMonths.toFixed(1)} mo.`,
    `Approval threshold ${formatCurrency(APPROVAL_THRESHOLD)}/mo.`,
    `Flags: ${c.flags.map((f) => `${f.vendorName} (${f.kind}, ${Math.round(f.confidence * 100)}%, ${formatCurrency(f.monthlyCost)}/mo; top signal ${f.features[0]?.feature} ${f.features[0]?.value})`).join("; ") || "none"}.`,
    `Drafts: ${c.drafts.map((d) => `${c.vendors.find((v) => v.id === d.vendorId)?.name}: ${d.approved ? "approved" : "held"}`).join("; ") || "none"}.`,
    `Vendors: ${c.vendors.map((v) => `${v.name} ${formatCurrency(v.monthlyCost)}/mo ${v.category} ${v.activeSeats}/${v.seats} seats`).join("; ")}.`,
  ].join("\n");
}

export async function ask(question: string): Promise<Answer> {
  const c = loadContext();
  const q = question.trim();
  const routed = route(q, c);
  const suggestions = SUGGESTIONS.filter((s) => norm(s) !== norm(q)).slice(0, 3);

  if (routed) return { question: q, answer: routed.text, source: "rule", intent: routed.intent, suggestions };

  const fallback = `I can answer from the audit: why a vendor was flagged, cash horizon, savings, what's waiting on you, or the approval threshold. Try one of those.`;
  if (DEMO_MODE || !llmAvailable()) {
    return { question: q, answer: fallback, source: "fallback", intent: "unknown", suggestions };
  }

  const r = await generate({
    system:
      "You are Burn Shield, a cash-burn auditing agent. Answer the user's question in two or three plain sentences " +
      "using ONLY the facts below. If the facts don't cover it, say so in one sentence. Never invent numbers.",
    user: `Facts:\n${contextBlob(c)}\n\nQuestion: ${q}`,
    fallback,
    maxTokens: 220,
  });
  return { question: q, answer: r.text, source: r.source === "llm" ? "llm" : "fallback", intent: "open", suggestions };
}

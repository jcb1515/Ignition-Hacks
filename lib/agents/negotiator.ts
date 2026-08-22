/**
 * Negotiator Agent — turns a flag into a specific, sendable ask.
 *
 * Two tool calls, not one. Before drafting, it resolves where the message
 * should actually go via `lookupBillingContact` — a real second tool in the
 * chain rather than a hardcoded address on the vendor record. The draft is
 * then written by the LLM, or from a deterministic template in demo mode.
 *
 * Nothing is ever sent. Drafts land in the drafts table and, if SMTP is
 * configured, in a Mailtrap sandbox inbox. There is no code path to a real
 * vendor's mailbox, deliberately.
 */
import { formatCurrency } from "@/lib/types";
import type { Flag, Vendor } from "@/lib/types";
import { generate } from "@/lib/llm";
import { estimateSavings } from "@/lib/agents/forecast";
import { COMPANY } from "@/lib/company";

export interface NegotiationDraft {
  vendorId: string;
  vendorName: string;
  subject: string;
  body: string;
  toEmail: string;
  contactSource: string;
  monthlySavings: number;
  /** "llm" when a model wrote it, "fallback" when the template did. */
  source: string;
}

/* ---------------- tool 1: billing contact lookup ---------------- */

/**
 * Resolves a vendor's billing contact. Tries a real lookup when a search key
 * is configured, then falls back to the address on file and finally to the
 * conventional billing@ alias. Returns the provenance so the action log can
 * say where the address came from rather than pretending it was always known.
 */
export async function lookupBillingContact(
  vendor: Vendor
): Promise<{ email: string; source: string }> {
  const key = process.env.SEARCH_API_KEY;
  const domain = vendor.contactEmail.split("@")[1];

  if (key && domain) {
    try {
      const res = await fetch(
        `https://api.tavily.com/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: key,
            query: `${vendor.name} billing contact email for enterprise account changes`,
            max_results: 3,
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const blob = JSON.stringify(data);
        const match = blob.match(
          new RegExp(`[a-zA-Z0-9._%+-]+@${domain.replace(".", "\\.")}`)
        );
        if (match) return { email: match[0], source: "web search (Tavily)" };
      }
    } catch {
      // fall through to the offline resolution below
    }
  }

  if (vendor.contactEmail) {
    return { email: vendor.contactEmail, source: "vendor record on file" };
  }
  return { email: `billing@${domain ?? "example.com"}`, source: "inferred billing alias" };
}

/* ---------------- tool 2: draft the message ---------------- */

/** The ask changes with the finding. A cancellation is not a rate negotiation. */
function askFor(flag: Flag, vendor: Vendor, savings: number): { intent: string; instruction: string } {
  switch (flag.kind) {
    case "overpriced":
      return {
        intent: "rate renegotiation",
        instruction: `Ask for a rate review. We are paying ${formatCurrency(vendor.monthlyCost)}/mo, well above what comparable ${vendor.category.toLowerCase()} vendors charge us. Target roughly ${formatCurrency(vendor.monthlyCost - savings)}/mo. Mention we are evaluating alternatives, but stay collaborative — we want to stay.`,
      };
    case "duplicate":
      return {
        intent: "cancellation",
        instruction: `Request cancellation at the end of the current term. We have consolidated onto another tool that does the same job. Ask about data export and confirm the final billing date. Be courteous and brief; this is not a negotiation.`,
      };
    case "usage_drift":
      return {
        intent: "tier downgrade",
        instruction: `Request a downgrade. We are provisioned for ${vendor.seats} seats but only ${vendor.activeSeats} are active. Ask what tier fits actual usage and whether the change can take effect next billing cycle rather than at renewal.`,
      };
    case "price_creep":
      return {
        intent: "billing review",
        instruction: `Ask for an itemised explanation of the increase. The bill has risen substantially over recent periods with no plan change on our side. Request a breakdown of what drove it and whether a committed-use discount would bring it back down.`,
      };
  }
}

export async function negotiate(flag: Flag, vendor: Vendor, allVendors: Vendor[]): Promise<NegotiationDraft> {
  const savings = estimateSavings(flag, allVendors);
  const { intent, instruction } = askFor(flag, vendor, savings);
  const contact = await lookupBillingContact(vendor);

  const subject =
    flag.kind === "duplicate"
      ? `${vendor.name} — cancellation at end of current term`
      : flag.kind === "usage_drift"
        ? `${vendor.name} — plan downgrade request`
        : flag.kind === "price_creep"
          ? `${vendor.name} — billing review request`
          : `${vendor.name} — rate review request`;

  const evidence = flag.features
    .slice(0, 2)
    .map((f) => `- ${f.feature.replaceAll("_", " ")}: ${f.value}`)
    .join("\n");

  const fallback = buildTemplate(flag, vendor, savings);

  const result = await generate({
    system:
      "You draft short, professional vendor emails for a startup's finance team. " +
      "Be direct and specific. Cite concrete numbers. Never threaten. Never invent " +
      "facts, discounts, or competitor quotes that were not given to you. " +
      "Output only the email body — no subject line, no preamble, no markdown.",
    user:
      `Company: ${COMPANY.name}, a ${COMPANY.headcount}-person startup.\n` +
      `Vendor: ${vendor.name} (${vendor.category}), ${formatCurrency(vendor.monthlyCost)}/mo, terms: ${vendor.contractTerms}.\n` +
      `Finding: ${flag.headline}\n` +
      `Supporting evidence:\n${evidence}\n\n` +
      `Write a ${intent} email. ${instruction}\n` +
      `Sign off as "The ${COMPANY.name} finance team". Keep it under 150 words.`,
    fallback,
    maxTokens: 500,
  });

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    subject,
    body: result.text,
    toEmail: contact.email,
    contactSource: contact.source,
    monthlySavings: savings,
    source: result.source,
  };
}

function buildTemplate(flag: Flag, vendor: Vendor, savings: number): string {
  const target = formatCurrency(Math.max(0, vendor.monthlyCost - savings));
  const cost = formatCurrency(vendor.monthlyCost);

  if (flag.kind === "duplicate") {
    return `Hi ${vendor.name} team,

We're consolidating our internal tooling and have moved the work ${vendor.name} was covering onto a single system. We'd like to cancel our subscription at the end of the current term.

Our current plan is ${cost}/month under ${vendor.contractTerms.toLowerCase()} terms. Could you confirm the final billing date and let us know the process for exporting our data?

Thanks for the work over the past year — this is a consolidation decision, not a reflection on the product.

The ${COMPANY.name} finance team`;
  }

  if (flag.kind === "usage_drift") {
    return `Hi ${vendor.name} team,

We're reviewing our ${vendor.category.toLowerCase()} spend ahead of next quarter. We're currently provisioned for ${vendor.seats} seats at ${cost}/month, but only ${vendor.activeSeats} are active — the tier was sized for growth that landed differently than we planned.

Could you help us find a plan that matches actual usage? We're targeting something closer to ${target}/month. We'd also like to know whether a change can take effect at the next billing cycle rather than waiting for renewal.

Happy to jump on a short call this week.

The ${COMPANY.name} finance team`;
  }

  if (flag.kind === "price_creep") {
    return `Hi ${vendor.name} team,

Our ${vendor.name} bill has risen substantially over the last six billing periods without a plan change on our side. We'd like an itemised breakdown of what's driving the increase.

We're currently at ${cost}/month. If a committed-use or annual agreement would bring that back toward ${target}/month, we're open to discussing it.

Could someone from your billing team walk us through the detail this week?

The ${COMPANY.name} finance team`;
  }

  return `Hi ${vendor.name} team,

We're reviewing our ${vendor.category.toLowerCase()} tooling budget for the year. Our current spend with ${vendor.name} is ${cost}/month, which is meaningfully above what we're paying comparable vendors in the same category.

We'd like to explore whether there's a tier or an annual commitment that gets us closer to ${target}/month. We'd prefer to stay — ${vendor.name} works well for the team — but we do need the economics to line up.

Could we find 15 minutes this week to talk it through?

The ${COMPANY.name} finance team`;
}

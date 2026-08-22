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
import { COMPANY, DEMO_MODE } from "@/lib/company";

export interface NegotiationDraft {
  vendorId: string;
  vendorName: string;
  subject: string;
  body: string;
  toEmail: string;
  contactSource: string;
  /** Supporting URL when the address came from a live search. */
  contactCitation?: string;
  monthlySavings: number;
  /** "llm" when a model wrote it, "fallback" when the template did. */
  source: string;
}

/* ---------------- tool 1: billing contact lookup ---------------- */

export interface ContactResolution {
  email: string;
  /** Where the address came from, shown verbatim in the action log. */
  source: string;
  /** Supporting URL when a search produced the address. */
  citation?: string;
}

/**
 * Only accept an address on the vendor's own domain.
 *
 * Search results are full of aggregators, directories and support-desk relays.
 * An address scraped from one of those is worse than no lookup at all, because
 * it looks authoritative in the log while being wrong. Subdomains are allowed
 * (billing.atlassian.com), unrelated hosts are not.
 */
function onVendorDomain(email: string, domain: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const host = email.slice(at + 1).toLowerCase();
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** First address in `text` that belongs to `domain`, if any. */
function firstMatchingEmail(text: string, domain: string): string | undefined {
  for (const candidate of text.match(EMAIL_RE) ?? []) {
    if (onVendorDomain(candidate, domain)) return candidate;
  }
  return undefined;
}

/**
 * Composio's managed web search, invoked through the local `composio` CLI.
 *
 * The CLI carries its own managed credentials, so this needs no signup and no
 * key in .env — which is the whole reason it is the first tier. It is a real
 * network call to a real search API with its own auth and failure modes, not
 * another prompt to the same model.
 *
 * Shelling out rather than calling the HTTP API directly is deliberate: the
 * v3 REST endpoint wants a dashboard API key, while the CLI credential is
 * already present on a machine where someone has run `composio login`.
 */
async function viaComposio(
  vendor: Vendor,
  domain: string
): Promise<ContactResolution | undefined> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);

  // Deliberately not site:-restricted. A site: operator makes the search
  // summarise the vendor's billing *docs* rather than surface an address, and
  // returns nothing usable. The on-domain check below is what enforces
  // correctness, so the query itself can stay broad.
  const query = `${vendor.name} billing support contact email address`;

  let stdout: string;
  try {
    ({ stdout } = await run(
      "composio",
      ["execute", "COMPOSIO_SEARCH_WEB", "-d", JSON.stringify({ query })],
      { timeout: 25_000, maxBuffer: 4 * 1024 * 1024 }
    ));
  } catch {
    return undefined; // CLI missing, not logged in, or timed out
  }

  let body: unknown;
  try {
    body = JSON.parse(stdout);
  } catch {
    return undefined;
  }

  const data = (body as { successful?: boolean; data?: Record<string, unknown> });
  if (data?.successful === false) return undefined;

  const answer = String(data?.data?.answer ?? "");
  const citations = (data?.data?.citations ?? []) as Array<{ url?: string }>;

  const email =
    firstMatchingEmail(answer, domain) ??
    firstMatchingEmail(JSON.stringify(citations), domain);
  if (!email) return undefined;

  return {
    email,
    source: "live web search (Composio)",
    citation: citations.find((c) => c.url)?.url,
  };
}

/** Tavily, kept as a second search provider when a key is configured. */
async function viaTavily(
  vendor: Vendor,
  domain: string
): Promise<ContactResolution | undefined> {
  const key = process.env.SEARCH_API_KEY;
  if (!key) return undefined;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: `${vendor.name} billing contact email for enterprise account changes`,
      max_results: 3,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return undefined;

  const data = await res.json();
  const email = firstMatchingEmail(JSON.stringify(data), domain);
  return email ? { email, source: "web search (Tavily)" } : undefined;
}

/** A search provider: takes a vendor and its domain, returns a hit or nothing. */
export type SearchProvider = (
  vendor: Vendor,
  domain: string
) => Promise<ContactResolution | undefined>;

/**
 * The resolution policy, with its providers injected.
 *
 * Pure with respect to the environment: it reads no env vars and opens no
 * connections of its own, so the fallback order and the same-domain rule can
 * be tested directly by passing stub providers. `lookupBillingContact` is the
 * thin env-driven wrapper around it.
 *
 * Providers are tried in order. Any that throws or returns nothing falls
 * through to the next — a contact lookup must never be able to fail a whole
 * audit. If none produce an on-domain address, the address on file wins.
 */
export async function resolveBillingContact(
  vendor: Vendor,
  providers: SearchProvider[] = []
): Promise<ContactResolution> {
  const domain = vendor.contactEmail.split("@")[1] ?? "";

  if (domain) {
    for (const provider of providers) {
      try {
        const hit = await provider(vendor, domain);
        // Re-check the domain here rather than trusting the provider, so a
        // badly-behaved provider cannot smuggle an aggregator address through.
        if (hit && onVendorDomain(hit.email, domain)) return hit;
      } catch {
        // fall through to the next tier
      }
    }
  }

  // Require an actual address, not merely a non-empty field. A record holding
  // "nonsense" would otherwise be handed straight to the mailer as a contact.
  if (vendor.contactEmail.includes("@")) {
    return { email: vendor.contactEmail, source: "vendor record on file" };
  }
  return { email: `billing@${domain || "example.com"}`, source: "inferred billing alias" };
}

/**
 * Env-driven entry point used by the Negotiator.
 *
 * In DEMO_MODE no providers are passed at all, so the demo makes no network
 * calls and always resolves from the vendor record — deterministically.
 */
export async function lookupBillingContact(vendor: Vendor): Promise<ContactResolution> {
  const providers = DEMO_MODE ? [] : [viaComposio, viaTavily];
  return resolveBillingContact(vendor, providers);
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
    case "billing_spike":
      return {
        intent: "invoice credit request",
        instruction: `One invoice was far above our normal monthly amount with no change in usage or plan on our side. Ask for an itemised explanation of that invoice and a credit of roughly ${formatCurrency(savings)} for the overage, applied to the next bill. Be factual, not accusatory — it may be a metering or billing error.`,
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
          : flag.kind === "billing_spike"
            ? `${vendor.name} — query on an unusually high invoice`
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
    contactCitation: contact.citation,
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

  if (flag.kind === "billing_spike") {
    const credit = formatCurrency(savings);
    return `Hi ${vendor.name} team,

While reconciling our accounts we noticed one ${vendor.name} invoice that was well above our usual monthly amount of ${cost}, with no change in our plan or usage that would explain it.

Could you send an itemised breakdown of that invoice? If the overage turns out to be a metering or billing error, we'd ask for a credit of approximately ${credit} against our next bill.

Happy to share our own usage records if that helps trace it.

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

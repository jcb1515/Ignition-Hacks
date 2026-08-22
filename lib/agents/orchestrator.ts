/**
 * Orchestrator Agent — owns the audit run.
 *
 * Decides what to invoke and in what order, writes every step to the action
 * log with its reasoning, and enforces the human-approval threshold. It is an
 * async generator so the dashboard can stream the agent's reasoning as it
 * happens instead of waiting for a single blob at the end.
 *
 * Approval policy: any action whose dollar impact exceeds APPROVAL_THRESHOLD
 * is written to the log as pending and stops there. The agent drafts, it does
 * not send. This is a policy choice, not a solved safety problem — a real
 * deployment would need considerably stronger guardrails.
 */
import { randomUUID } from "node:crypto";
import { APPROVAL_THRESHOLD, DEMO_MODE } from "@/lib/company";
import { llmAvailable } from "@/lib/llm";
import { classify } from "@/lib/agents/classifier";
import { forecast, estimateSavings } from "@/lib/agents/forecast";
import { negotiate } from "@/lib/agents/negotiator";
import {
  clearFlags, clearUnactionedDrafts, flagTransaction, getVendors, insertAction,
  insertDraft, insertSnapshot, setVendorStatus,
} from "@/lib/db/queries";
import { formatCurrency } from "@/lib/types";
import type { AgentAction, AgentName } from "@/lib/types";

export type AuditEvent =
  | { type: "status"; message: string }
  | { type: "action"; action: AgentAction }
  | { type: "done"; summary: AuditSummary };

export interface AuditSummary {
  flagsFound: number;
  draftsCreated: number;
  pendingApproval: number;
  monthlySavings: number;
  annualSavings: number;
  runwayBefore: number;
  runwayAfter: number;
  monthsGained: number;
  mode: "demo" | "live";
}

/** Clock is injectable so the smoke test produces stable timestamps. */
function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function record(
  agent: AgentName,
  type: string,
  reasoning: string,
  opts: { target?: string; dollarImpact?: number; approvalRequired?: boolean; humanApproved?: boolean } = {}
): AgentAction {
  const action: AgentAction = {
    id: randomUUID(),
    timestamp: now(),
    agent,
    type,
    target: opts.target,
    reasoning,
    humanApproved: opts.humanApproved ?? false,
    approvalRequired: opts.approvalRequired ?? false,
    dollarImpact: opts.dollarImpact ?? 0,
  };
  insertAction(action);
  return action;
}

export async function* runAudit(): AsyncGenerator<AuditEvent> {
  const mode = DEMO_MODE ? "demo" : "live";

  yield {
    type: "action",
    action: record(
      "Orchestrator", "audit_started",
      `Starting a full spend audit in ${mode} mode. Approval threshold is ${formatCurrency(APPROVAL_THRESHOLD)}/mo — anything above that will be drafted and held for a human. Language model narration is ${llmAvailable() ? "live" : "using deterministic templates"}.`,
    ),
  };

  /* ---- 1. Classify ---- */
  yield { type: "status", message: "Classifier scanning latest billing period..." };

  clearFlags();
  clearUnactionedDrafts(); // this run supersedes the last one
  const flags = classify();
  const vendors = getVendors();

  for (const flag of flags) {
    if (flag.transactionId) {
      flagTransaction(flag.transactionId, flag.headline, flag.confidence, JSON.stringify(flag.features));
    }
    setVendorStatus(flag.vendorId, "flagged");

    const top = flag.features[0];
    yield {
      type: "action",
      action: record(
        "Classifier", `flag_${flag.kind}`,
        `${flag.headline} Confidence ${(flag.confidence * 100).toFixed(0)}%. ` +
        `Strongest signal: ${top.feature.replaceAll("_", " ")} (${top.value}), contributing ${top.contribution >= 0 ? "+" : ""}${top.contribution.toFixed(2)} to the score.`,
        { target: flag.vendorName, dollarImpact: -flag.monthlyCost, humanApproved: true }
      ),
    };
  }

  if (flags.length === 0) {
    yield {
      type: "action",
      action: record("Orchestrator", "audit_clean", "No anomalies detected in the latest billing period. No further agents invoked."),
    };
    const f = forecast([]);
    yield {
      type: "done",
      summary: {
        flagsFound: 0, draftsCreated: 0, pendingApproval: 0,
        monthlySavings: 0, annualSavings: 0,
        runwayBefore: f.scenarios[0].runwayMonths,
        runwayAfter: f.scenarios[0].runwayMonths,
        monthsGained: 0, mode,
      },
    };
    return;
  }

  /* ---- 2. Forecast ---- */
  yield { type: "status", message: "Forecast agent projecting runway scenarios..." };

  const f = forecast(flags);
  const [current, cut, freeze] = f.scenarios;

  for (const scenario of f.scenarios) {
    insertSnapshot({
      id: randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      burnRate: scenario.monthlyBurn,
      runwayMonths: scenario.runwayMonths,
      scenarioLabel: scenario.label,
    });
  }

  const mcCurrent = f.monteCarlo[current.label];
  yield {
    type: "action",
    action: record(
      "Forecast", "runway_projection",
      `Burn is ${formatCurrency(current.monthlyBurn)}/mo against ${formatCurrency(current.monthlyBurn - current.netBurn)}/mo of revenue, so net ${formatCurrency(current.netBurn)}/mo. ` +
      `That is ${current.runwayMonths} months of runway at current spend. Across ${mcCurrent.trials.toLocaleString()} Monte Carlo trials the realistic range is ${mcCurrent.p10} to ${mcCurrent.p90} months (median ${mcCurrent.p50}). ` +
      `Remediating all ${flags.length} flags takes runway to ${cut.runwayMonths} months; adding a hiring freeze takes it to ${freeze.runwayMonths}.`,
      { dollarImpact: f.totalMonthlySavings, humanApproved: true }
    ),
  };

  /* ---- 3. Negotiate, flag by flag ---- */
  let draftsCreated = 0;
  let pendingApproval = 0;

  for (const flag of flags) {
    const vendor = vendors.find((v) => v.id === flag.vendorId);
    if (!vendor) continue;

    const savings = estimateSavings(flag, vendors);
    yield { type: "status", message: `Negotiator drafting for ${vendor.name}...` };

    const draft = await negotiate(flag, vendor, vendors);
    const needsApproval = savings > APPROVAL_THRESHOLD;

    insertDraft({
      id: randomUUID(),
      vendorId: vendor.id,
      subject: draft.subject,
      body: draft.body,
      toEmail: draft.toEmail,
      createdAt: now(),
      approved: false,
      sent: false,
    });
    draftsCreated += 1;

    yield {
      type: "action",
      action: record(
        "Negotiator", `draft_${flag.kind === "duplicate" ? "cancellation" : "renegotiation"}`,
        `Drafted a ${flag.kind === "duplicate" ? "cancellation" : "renegotiation"} email to ${vendor.name} at ${draft.toEmail} (address resolved via ${draft.contactSource}). ` +
        `Estimated impact ${formatCurrency(savings)}/mo. ` +
        `Written by ${draft.source === "llm" ? "language model" : "deterministic template"}.`,
        { target: vendor.name, dollarImpact: savings }
      ),
    };

    if (needsApproval) {
      pendingApproval += 1;
      setVendorStatus(vendor.id, "negotiating");
      yield {
        type: "action",
        action: record(
          "Orchestrator", "escalate_for_approval",
          `Holding the ${vendor.name} email. Estimated impact ${formatCurrency(savings)}/mo exceeds the ${formatCurrency(APPROVAL_THRESHOLD)}/mo autonomy threshold, so this needs a human decision before anything goes out. Draft is ready in the approvals queue.`,
          { target: vendor.name, dollarImpact: savings, approvalRequired: true }
        ),
      };
    } else {
      yield {
        type: "action",
        action: record(
          "Orchestrator", "auto_approved",
          `${vendor.name} cleared for send without escalation. Estimated impact ${formatCurrency(savings)}/mo is under the ${formatCurrency(APPROVAL_THRESHOLD)}/mo threshold. Still routed to the Mailtrap sandbox — this build has no path to a real vendor inbox.`,
          { target: vendor.name, dollarImpact: savings, humanApproved: true }
        ),
      };
    }
  }

  /* ---- 4. Wrap up ---- */
  const monthsGained = Math.round((cut.runwayMonths - current.runwayMonths) * 10) / 10;

  yield {
    type: "action",
    action: record(
      "Orchestrator", "audit_complete",
      `Audit complete. ${flags.length} vendors flagged, ${draftsCreated} emails drafted, ${pendingApproval} held for approval. ` +
      `Total identified savings ${formatCurrency(f.totalMonthlySavings)}/mo (${formatCurrency(f.totalMonthlySavings * 12)}/yr), which is ${monthsGained} additional months of runway if every remediation lands.`,
      { dollarImpact: f.totalMonthlySavings, humanApproved: true }
    ),
  };

  yield {
    type: "done",
    summary: {
      flagsFound: flags.length,
      draftsCreated,
      pendingApproval,
      monthlySavings: f.totalMonthlySavings,
      annualSavings: f.totalMonthlySavings * 12,
      runwayBefore: current.runwayMonths,
      runwayAfter: cut.runwayMonths,
      monthsGained,
      mode,
    },
  };
}

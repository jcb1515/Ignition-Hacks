import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { approveAction, getActions, getVendors, insertAction, setVendorStatus } from "@/lib/db/queries";
import { formatCurrency } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Records the human side of the negotiation gate.
 *
 * POST { actionId, decision: "accept" | "walk" }
 *   actionId must be a negotiation_accept_pending or negotiation_escalated row.
 *   accept → the deal the agent recommended (or the vendor's best offer) is taken;
 *            the vendor moves to "negotiating" (contract change in flight) or
 *            "cancelled" for a duplicate.
 *   walk   → the offer is declined; vendor stays flagged for a replacement.
 * Either way a human_decision row is written with the dollar impact, so the
 * log shows who decided what — the agent recommended, the human signed.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { actionId, decision } = body as { actionId?: string; decision?: string };
  if (!actionId || (decision !== "accept" && decision !== "walk")) {
    return NextResponse.json({ error: "actionId and decision ('accept' | 'walk') are required" }, { status: 400 });
  }
  const action = getActions(2000).find((a) => a.id === actionId);
  if (!action) return NextResponse.json({ error: "action not found" }, { status: 404 });
  if (!action.approvalRequired || !/^negotiation_(accept_pending|escalated)$/.test(action.type)) {
    return NextResponse.json({ error: "that action is not awaiting a negotiation decision" }, { status: 409 });
  }
  if (action.humanApproved) return NextResponse.json({ error: "already decided" }, { status: 409 });

  const vendor = getVendors().find((v) => v.name === action.target);
  const savings = action.dollarImpact;
  approveAction(actionId);

  if (vendor) {
    if (decision === "accept") {
      const isCancel = vendor.monthlyCost - savings <= 0;
      setVendorStatus(vendor.id, isCancel ? "cancelled" : "negotiating");
    } else {
      setVendorStatus(vendor.id, "flagged");
    }
  }

  const reasoning = decision === "accept"
    ? `Human accepted the ${action.target} deal: ${formatCurrency(savings)}/mo (${formatCurrency(savings * 12)}/yr). The agent recommended; a person signed — that is the approval threshold doing its job.`
    : `Human declined ${action.target}'s best offer (${formatCurrency(savings)}/mo). Vendor stays flagged; next step is sourcing a replacement.`;

  insertAction({
    id: randomUUID(),
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    agent: "Orchestrator",
    type: `human_${decision}`,
    target: action.target,
    reasoning,
    humanApproved: true,
    approvalRequired: false,
    dollarImpact: decision === "accept" ? savings : 0,
  });

  return NextResponse.json({ ok: true, decision, vendor: action.target, monthlySavings: decision === "accept" ? savings : 0 });
}

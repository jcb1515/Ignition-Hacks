import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  approveAction, approveDraft, getDrafts, getVendor,
  insertAction, markDraftSent, setVendorStatus,
} from "@/lib/db/queries";
import { deliver } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * Records a human decision on a held draft.
 *
 * Approving routes the message to the Mailtrap sandbox. There is no code path
 * from here to a real vendor's inbox — `deliver` targets a sandbox host and
 * refuses to run against anything else.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { draftId, actionId, decision } = body as {
    draftId?: string;
    actionId?: string;
    decision?: "approve" | "reject";
  };

  if (!draftId || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json(
      { error: "draftId and decision ('approve' | 'reject') are required" },
      { status: 400 }
    );
  }

  const draft = getDrafts().find((d) => d.id === draftId);
  if (!draft) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }

  const vendor = getVendor(draft.vendorId);
  const vendorName = vendor?.name ?? draft.vendorId;
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  if (decision === "reject") {
    setVendorStatus(draft.vendorId, "safe");
    insertAction({
      id: randomUUID(),
      timestamp,
      agent: "Orchestrator",
      type: "human_rejected",
      target: vendorName,
      reasoning: `A human declined the ${vendorName} draft. The vendor is returned to normal monitoring and no message was sent. The finding stays in the log — rejecting the action does not erase the evidence that produced it.`,
      humanApproved: false,
      approvalRequired: false,
      dollarImpact: 0,
    });
    if (actionId) approveAction(actionId);
    return NextResponse.json({ ok: true, decision: "reject" });
  }

  approveDraft(draftId);
  if (actionId) approveAction(actionId);

  const delivery = await deliver(draft);
  if (delivery.sent) markDraftSent(draftId);
  setVendorStatus(draft.vendorId, "negotiating");

  insertAction({
    id: randomUUID(),
    timestamp,
    agent: "Orchestrator",
    type: "human_approved",
    target: vendorName,
    reasoning:
      `A human approved the ${vendorName} draft. ${delivery.detail} ` +
      `Vendor moved to negotiating. The projected saving stays projected until the next billing period confirms it — an approved email is not a booked saving.`,
    humanApproved: true,
    approvalRequired: false,
    dollarImpact: 0,
  });

  return NextResponse.json({ ok: true, decision: "approve", delivery });
}

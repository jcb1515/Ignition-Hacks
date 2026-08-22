"use client";

import { useState } from "react";
import { Check, Mail, ShieldAlert, X } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { Draft } from "@/lib/db/queries";
import NegotiationThread from "@/components/negotiation-thread";

export interface QueueItem extends Draft {
  savings: number;
  needsApproval: boolean;
}

/**
 * The human-in-the-loop surface. Drafts above the autonomy threshold sit here
 * until somebody decides. Approving routes to a Mailtrap sandbox — there is no
 * path from this button to a real vendor's inbox.
 */
export default function ApprovalQueue({
  drafts, threshold, onDecide, onNegotiated,
}: {
  drafts: QueueItem[];
  threshold: number;
  onDecide: (draftId: string, decision: "approve" | "reject") => Promise<void>;
  /** Called when a negotiation round or a human deal decision changes state. */
  onNegotiated?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(drafts[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);

  if (drafts.length === 0) {
    return (
      <div className="flex items-center justify-center border border-dashed border-border-card p-8 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-slate">
          No drafts yet. Run an audit and the Negotiator will queue its emails here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drafts.map((d) => {
        const open = openId === d.id;
        return (
          <div key={d.id} className="border border-border-card bg-card-2">
            <button
              onClick={() => setOpenId(open ? null : d.id)}
              className="flex w-full items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-card-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Mail size={13} className="shrink-0 text-muted" />
                  <span className="font-medium text-on-card">{d.subject}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-slate">To: {d.toEmail}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm text-[var(--color-series-2)]">
                  {formatCurrency(d.savings)}/mo
                </p>
                {d.sent ? (
                  <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-series-2)]">
                    <Check size={10} /> In sandbox
                  </span>
                ) : d.approved ? (
                  <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                    <Check size={10} /> Approved
                  </span>
                ) : d.needsApproval ? (
                  <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-series-1)]">
                    <ShieldAlert size={10} /> Held
                  </span>
                ) : (
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-slate">
                    Under threshold
                  </span>
                )}
              </div>
            </button>

            {open && (
              <div className="border-t border-border-card p-4">
                <pre className="mb-4 whitespace-pre-wrap border border-border-card bg-card p-4 font-body text-sm leading-relaxed text-on-card">
{d.body}
                </pre>

                {d.needsApproval && !d.approved && (
                  <p className="mb-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
                    <ShieldAlert size={13} className="mt-0.5 shrink-0 text-[var(--color-series-1)]" />
                    <span>
                      Estimated impact exceeds the {formatCurrency(threshold)}/mo autonomy
                      threshold, so the agent stopped here rather than acting.
                    </span>
                  </p>
                )}

                {!d.approved ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy === d.id}
                      onClick={async () => {
                        setBusy(d.id);
                        await onDecide(d.id, "approve");
                        setBusy(null);
                      }}
                      className="inline-flex items-center gap-2 bg-on-card px-4 py-2.5 text-sm font-medium text-card transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Check size={14} /> Approve and send to sandbox
                    </button>
                    <button
                      disabled={busy === d.id}
                      onClick={async () => {
                        setBusy(d.id);
                        await onDecide(d.id, "reject");
                        setBusy(null);
                      }}
                      className="inline-flex items-center gap-2 border border-border-card px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-on-card disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                ) : (
                  <p className="font-mono text-[11px] text-slate">
                    Decision recorded. {d.sent ? "Delivered to the Mailtrap sandbox inbox." : "Not transmitted — no sandbox inbox configured."}
                  </p>
                )}

                {/* The email is the opening ask; this is the rest of the conversation. */}
                <div className="mt-4">
                  <NegotiationThread
                    vendorId={d.vendorId}
                    vendorName={d.subject.split(" — ")[0]}
                    onDone={onNegotiated}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { Bot, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { AgentAction } from "@/lib/types";

export default function ActionLog({ actions }: { actions: AgentAction[] }) {
  return (
    <div className="divide-y divide-border-card">
      {actions.map((action) => (
        <div key={action.id} className="py-4 first:pt-0 last:pb-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-tight text-muted">
              <Bot size={12} className="text-mint" />
              {action.agent}
            </span>
            <span className="text-xs text-slate">{action.timestamp}</span>
          </div>
          <p className="mb-2 text-sm font-medium text-on-card">
            {action.type}
            {action.target && ` · ${action.target}`}
          </p>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            {action.reasoning}
          </p>
          <div className="flex items-center justify-between pt-2">
            <span className="font-display text-2xl font-medium leading-none text-on-card">
              {action.dollarImpact !== 0
                ? formatCurrency(Math.abs(action.dollarImpact))
                : "—"}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
              {action.humanApproved ? (
                <>
                  <CheckCircle2 size={12} className="text-mint" /> Approved
                </>
              ) : (
                <>
                  <XCircle size={12} className="text-slate" /> Pending
                </>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

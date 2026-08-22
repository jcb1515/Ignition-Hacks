import { Bot, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { AgentAction } from "@/lib/types";

const cashHorizonCopy = (value: string) =>
  value.replace(/\brunway\b/gi, "cash horizon");

export default function ActionLog({ actions }: { actions: AgentAction[] }) {
  return (
    <div className="max-h-[420px] divide-y divide-border-card overflow-y-auto pr-1">
      {actions.map((action) => (
        <div key={action.id} className="group py-4 transition-colors duration-200 first:pt-0 last:pb-0 hover:bg-card-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium uppercase tracking-wider text-muted">
              <Bot size={12} className="text-azure" />
              {action.agent}
            </span>
            <span className="font-sans text-xs font-medium uppercase tracking-wider text-muted">{action.timestamp}</span>
          </div>
          <p className="mb-2 font-sans text-sm font-medium uppercase tracking-wider text-on-card">
            {cashHorizonCopy(action.type.replaceAll("_", " "))}
            {action.target && ` · ${action.target}`}
          </p>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            {cashHorizonCopy(action.reasoning)}
          </p>
          <div className="flex items-center justify-between pt-2">
            <span className="font-display text-2xl font-medium leading-none text-on-card">
              {action.dollarImpact !== 0
                ? formatCurrency(Math.abs(action.dollarImpact))
                : "—"}
            </span>
            <span className="inline-flex items-center gap-1 font-sans text-xs font-medium uppercase tracking-wider text-muted">
              {action.humanApproved ? (
                <>
                  <CheckCircle2 size={12} className="text-azure" /> Approved
                </>
              ) : (
                <>
                  <XCircle size={12} className="text-muted" /> Pending
                </>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

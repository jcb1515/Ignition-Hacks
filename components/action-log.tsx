import { Bot, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { AgentAction } from "@/lib/types";

export default function ActionLog({ actions }: { actions: AgentAction[] }) {
  return (
    <div className="max-h-[420px] divide-y divide-border-card overflow-y-auto pr-1">
      {actions.map((action) => (
        <div key={action.id} className="group animate-fade-in py-4 transition-colors duration-300 first:pt-0 last:pb-0 hover:bg-card-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              <Bot size={12} className="text-azure" />
              {action.agent}
            </span>
            <span className="font-mono text-[10px] text-slate">{action.timestamp}</span>
          </div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-on-card">
            {action.type.replaceAll("_", " ")}
            {action.target && ` · ${action.target}`}
          </p>
          <p className="mb-3 text-sm leading-relaxed text-muted transition-colors group-hover:text-on-card">
            {action.reasoning}
          </p>
          <div className="flex items-center justify-between pt-2">
            <span className="font-display text-2xl font-medium leading-none text-on-card">
              {action.dollarImpact !== 0
                ? formatCurrency(Math.abs(action.dollarImpact))
                : "—"}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {action.humanApproved ? (
                <>
                  <CheckCircle2 size={12} className="text-azure" /> Approved
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

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { Transaction } from "@/lib/types";

export default function TransactionFeed({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className={`data-row flex items-start justify-between rounded-xl border p-3 ${
            tx.flagged
              ? "border-red/60 bg-red/5 hover:border-red"
              : "border-border-card bg-card-2 hover:border-azure"
          }`}
        >
          <div>
            <p className="font-medium text-on-card">{tx.vendorName}</p>
            <p className="mt-0.5 font-sans text-xs font-medium uppercase tracking-wider text-muted">
              {tx.date} · {tx.source}
              {tx.confidence ? ` · ${Math.round(tx.confidence * 100)}% confidence` : ""}
            </p>
            {tx.flagged && tx.reason && (
              <p className="mt-1.5 text-xs leading-relaxed text-red">{tx.reason}</p>
            )}
          </div>
          <div className="text-right">
            <p
              className={`font-mono font-semibold ${
                tx.flagged ? "text-red" : "text-on-card"
              }`}
            >
              {formatCurrency(tx.amount)}
            </p>
            {tx.flagged ? (
              <AlertTriangle size={14} className="ml-auto mt-1 text-red" />
            ) : (
              <CheckCircle2 size={14} className="ml-auto mt-1 text-azure" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

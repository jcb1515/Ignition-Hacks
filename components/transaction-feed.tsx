import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import type { Transaction } from "@/lib/data";

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
          className={`flex items-start justify-between rounded-lg border p-3 ${
            tx.flagged
              ? "border-red bg-red/5"
              : "border-border-card bg-card-2"
          }`}
        >
          <div>
            <p className="font-medium text-on-card">{tx.vendorName}</p>
            <p className="text-xs text-muted">
              {tx.date} · {tx.source}
            </p>
            {tx.flagged && tx.reason && (
              <p className="mt-1 text-xs text-red">{tx.reason}</p>
            )}
          </div>
          <div className="text-right">
            <p
              className={`font-semibold ${
                tx.flagged ? "text-red" : "text-on-card"
              }`}
            >
              {formatCurrency(tx.amount)}
            </p>
            {tx.flagged ? (
              <AlertTriangle size={14} className="ml-auto text-red" />
            ) : (
              <CheckCircle2 size={14} className="ml-auto text-mint" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

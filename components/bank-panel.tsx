"use client";

import { formatCurrency } from "@/lib/data";
import { usePlaid, toTransactions } from "@/lib/use-plaid";
import PlaidLinkButton from "@/components/plaid-link-button";
import TransactionFeed from "@/components/transaction-feed";

export default function BankPanel() {
  const { connected, loading, balance, accounts, transactions, connect, disconnect } = usePlaid();

  if (!connected) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">
          Connect a Plaid sandbox account to pull in bank balances and transactions.
        </p>
        <div className="mt-4 inline-flex justify-center">
          <PlaidLinkButton onConnect={(c) => connect(c.accessToken)} />
        </div>
      </div>
    );
  }

  const txs = toTransactions(transactions.slice(0, 10));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.65fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="rounded-xl border border-border-card bg-card-2 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Bank balance
            </p>
            <p className="mt-2 font-display text-2xl font-medium text-on-card">
              {loading ? "—" : formatCurrency(balance)}
            </p>
          </div>
          <div className="rounded-xl border border-border-card bg-card-2 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Accounts
            </p>
            <p className="mt-2 font-display text-2xl font-medium text-on-card">
              {accounts.length}
            </p>
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="rounded-xl border border-border-card bg-card-2 p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Connected accounts
            </p>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.account_id}
                  className="flex items-center justify-between border-b border-border-card pb-2 last:border-b-0 last:pb-0 text-sm"
                >
                  <span className="text-muted">{account.name}</span>
                  <span className="font-mono text-on-card">
                    {formatCurrency(account.balances.current)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={disconnect}
          className="text-xs text-muted underline transition-colors hover:text-red"
        >
          Disconnect bank
        </button>
      </div>

      <div className="rounded-xl border border-border-card bg-card-2 p-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          Recent bank transactions
        </p>
        {txs.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto pr-1">
            <TransactionFeed transactions={txs} />
          </div>
        ) : loading ? (
          <p className="text-sm text-muted">Loading bank transactions...</p>
        ) : (
          <p className="text-sm text-muted">No bank transactions found in the last 90 days.</p>
        )}
      </div>
    </div>
  );
}

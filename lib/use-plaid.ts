"use client";

import { useCallback, useEffect, useState } from "react";
import type { Transaction } from "@/lib/data";

export interface PlaidAccount {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
  balances: {
    available: number | null;
    current: number;
    currency: string;
  };
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  name: string;
  amount: number;
  date: string;
  category?: string[];
  pending: boolean;
}

export interface PlaidState {
  accessToken: string | null;
  connected: boolean;
  loading: boolean;
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
  balance: number;
}

export function usePlaid() {
  const [state, setState] = useState<PlaidState>({
    accessToken: null,
    connected: false,
    loading: false,
    accounts: [],
    transactions: [],
    balance: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("plaid_access_token");
    if (saved) {
      setState((s) => ({ ...s, accessToken: saved, connected: true }));
    }

    const onConnect = (e: Event) => {
      const token = (e as CustomEvent<string>).detail || localStorage.getItem("plaid_access_token");
      if (token) {
        setState((s) => ({ ...s, accessToken: token, connected: true }));
      }
    };

    window.addEventListener("plaid-connected", onConnect);
    return () => window.removeEventListener("plaid-connected", onConnect);
  }, []);

  const fetchPlaid = useCallback(async (token: string) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [accountsRes, txRes] = await Promise.all([
        fetch("/api/plaid/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token }),
        }),
        fetch("/api/plaid/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token }),
        }),
      ]);

      const accountsData = await accountsRes.json();
      const txData = await txRes.json();

      const accounts: PlaidAccount[] = accountsData.accounts || [];
      const transactions: PlaidTransaction[] = txData.transactions || [];
      const balance = accounts.reduce(
        (sum: number, a: PlaidAccount) => sum + (a.balances.current || 0),
        0
      );

      setState((s) => ({
        ...s,
        loading: false,
        accounts,
        transactions,
        balance,
      }));
    } catch (err) {
      console.error("Plaid fetch failed:", err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (state.accessToken) {
      localStorage.setItem("plaid_access_token", state.accessToken);
      fetchPlaid(state.accessToken);
    }
  }, [state.accessToken, fetchPlaid]);

  const connect = useCallback(
    (accessToken: string) => {
      localStorage.setItem("plaid_access_token", accessToken);
      setState((s) => ({ ...s, accessToken, connected: true }));
      window.dispatchEvent(
        new CustomEvent("plaid-connected", { detail: accessToken })
      );
    },
    []
  );

  const disconnect = useCallback(() => {
    localStorage.removeItem("plaid_access_token");
    setState({
      accessToken: null,
      connected: false,
      loading: false,
      accounts: [],
      transactions: [],
      balance: 0,
    });
  }, []);

  return { ...state, connect, disconnect };
}

export function toTransactions(plaidTxs: PlaidTransaction[]): Transaction[] {
  return plaidTxs.map((tx) => ({
    id: tx.transaction_id,
    vendorId: tx.account_id,
    vendorName: tx.name,
    amount: Math.abs(tx.amount),
    date: tx.date,
    source: "Plaid",
    flagged: tx.amount > 1000 && !tx.pending,
    reason:
      tx.amount > 1000 && !tx.pending ? "Large bank outflow" : undefined,
    confidence: tx.amount > 1000 ? 0.85 : undefined,
  }));
}

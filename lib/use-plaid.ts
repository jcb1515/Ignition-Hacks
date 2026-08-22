"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Transaction } from "@/lib/types";

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

const TOKEN_KEY = "plaid_access_token";
const TOKEN_EVENT = "plaid-connected";

/**
 * The access token lives in localStorage and is read through an external
 * store, so the hook never calls setState inside an effect and the server
 * render (no token) hydrates cleanly before the client snapshot takes over.
 */
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function subscribeToken(onChange: () => void) {
  window.addEventListener(TOKEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TOKEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(TOKEN_EVENT, { detail: token }));
}

interface PlaidData {
  loading: boolean;
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
  balance: number;
}

const EMPTY: PlaidData = { loading: false, accounts: [], transactions: [], balance: 0 };

export function usePlaid() {
  const accessToken = useSyncExternalStore(subscribeToken, readToken, () => null);
  const [data, setData] = useState<PlaidData>(EMPTY);

  // Fetch whenever the token changes. Every setData here happens after an
  // await, i.e. in an async continuation, never synchronously in the effect.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setData((s) => ({ ...s, loading: true }));
      try {
        const body = JSON.stringify({ access_token: accessToken });
        const headers = { "Content-Type": "application/json" };
        const [accountsRes, txRes] = await Promise.all([
          fetch("/api/plaid/accounts", { method: "POST", headers, body }),
          fetch("/api/plaid/transactions", { method: "POST", headers, body }),
          // Also feed the linked Item into the agent tables, so "connect a bank"
          // → "run audit" is one story. Server-side, idempotent; failure is
          // non-fatal for the panel, which only needs the two calls above.
          fetch("/api/sync", { method: "POST", headers, body: JSON.stringify({ accessToken }) }).catch(() => null),
        ]);
        const accountsData = await accountsRes.json();
        const txData = await txRes.json();
        if (cancelled) return;

        const accounts: PlaidAccount[] = accountsData.accounts || [];
        const transactions: PlaidTransaction[] = txData.transactions || [];
        const balance = accounts.reduce((sum, a) => sum + (a.balances.current || 0), 0);
        setData({ loading: false, accounts, transactions, balance });
      } catch (err) {
        console.error("Plaid fetch failed:", err);
        if (!cancelled) setData((s) => ({ ...s, loading: false }));
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const connect = useCallback((token: string) => {
    writeToken(token);
  }, []);

  const disconnect = useCallback(() => {
    writeToken(null);
    setData(EMPTY);
  }, []);

  const state: PlaidState = {
    accessToken,
    connected: Boolean(accessToken),
    ...data,
  };

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

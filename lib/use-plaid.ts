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
        void fetch("/api/sync", {
          method: "POST",
          headers,
          body: JSON.stringify({ accessToken }),
        }).catch(() => null);

        const accountsRequest = fetch("/api/plaid/accounts", { method: "POST", headers, body });
        const transactionsRequest = (async () => {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const response = await fetch("/api/plaid/transactions", { method: "POST", headers, body });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to fetch Plaid transactions");
            if (result.transactions?.length || attempt === 2) return result;
            await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
          }
        })();
        const [accountsRes, txData] = await Promise.all([accountsRequest, transactionsRequest]);
        const accountsData = await accountsRes.json();
        if (!accountsRes.ok) throw new Error(accountsData.error || "Failed to fetch Plaid accounts");
        if (cancelled) return;

        const accounts: PlaidAccount[] = accountsData.accounts || [];
        const transactions: PlaidTransaction[] = txData?.transactions || [];
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
    setData({ ...EMPTY, loading: true });
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

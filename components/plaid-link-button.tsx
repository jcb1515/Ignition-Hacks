"use client";

import { useCallback, useState } from "react";

export interface PlaidConnection {
  accessToken: string;
  itemId: string;
}

let plaidScriptPromise: Promise<void> | null = null;

function loadPlaidScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).Plaid) return Promise.resolve();
  if (plaidScriptPromise) return plaidScriptPromise;

  const existing = document.querySelector(
    'script[src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"]'
  );
  if (existing) {
    plaidScriptPromise = new Promise((resolve, reject) => {
      if ((window as any).Plaid) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Plaid script failed to load"))
      );
    });
    return plaidScriptPromise;
  }

  plaidScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Plaid script failed to load"));
    document.body.appendChild(script);
  });

  return plaidScriptPromise;
}

export default function PlaidLinkButton({
  onConnect,
  disabled,
}: {
  onConnect: (connection: PlaidConnection) => void;
  disabled?: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (opening || disabled) return;
    setOpening(true);
    setError(null);

    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.link_token) {
        throw new Error(data.error || "Plaid is not configured");
      }

      await loadPlaidScript();
      const Plaid = (window as any).Plaid;

      const handler = Plaid.create({
        token: data.link_token,
        onSuccess: async (publicToken: string) => {
          const exchangeRes = await fetch("/api/plaid/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token: publicToken }),
          });
          const exchangeData = await exchangeRes.json();

          if (!exchangeRes.ok || !exchangeData.access_token) {
            throw new Error(exchangeData.error || "Token exchange failed");
          }

          onConnect({
            accessToken: exchangeData.access_token,
            itemId: exchangeData.item_id,
          });
        },
        onExit: () => {},
        onLoad: () => {},
      });

      handler.open();
    } catch (err) {
      setError((err as Error).message || "Failed to open Plaid");
    } finally {
      setOpening(false);
    }
  }, [disabled, onConnect, opening]);

  return (
    <div className="text-center">
      <button
        onClick={handleClick}
        disabled={disabled || opening}
        className="group inline-flex items-center gap-2 border border-page/30 bg-card-2 px-4 py-3 text-sm font-medium text-on-card transition-colors hover:border-azure hover:bg-azure hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="relative flex h-2 w-2">
          <span className="ping-ring absolute inset-0 rounded-full bg-azure" />
          <span className="relative h-2 w-2 rounded-full bg-azure" />
        </span>
        {opening ? "Opening Plaid..." : disabled ? "Bank connected" : "Connect bank (Plaid)"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red">{error}</p>
      ) : null}
    </div>
  );
}

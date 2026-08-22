"use client";

import { useEffect, useState } from "react";
import { Database, Radio } from "lucide-react";

interface SourceStatus { mode: "demo" | "live"; plaid: boolean; stripe: boolean }

/**
 * Says, honestly, where the numbers came from. When a judge asks "is this
 * live?" you point at this instead of answering from memory.
 */
export default function DataSourceBadge() {
  const [s, setS] = useState<SourceStatus | null>(null);

  useEffect(() => {
    fetch("/api/sync", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => setS(null));
  }, []);

  if (!s) return null;

  const live = s.mode === "live";
  const detail = live
    ? [s.plaid ? "Plaid sandbox" : null, s.stripe ? "Stripe test" : null].filter(Boolean).join(" + ") || "no keys configured"
    : "seeded data, no network calls";

  return (
    <span
      className="inline-flex items-center gap-2 border border-border-card bg-card-2 px-3 py-1.5 font-sans text-[10px] uppercase tracking-[0.12em] text-muted"
      title={live ? "DEMO_MODE=false — agents may call Plaid/Stripe sandboxes and the LLM" : "DEMO_MODE=true — deterministic; every run produces the same result"}
    >
      {live ? <Radio size={12} style={{ color: "var(--color-series-2)" }} /> : <Database size={12} style={{ color: "var(--color-mint)" }} />}
      <span className="text-on-card">{live ? "Live sandbox" : "Demo mode"}</span>
      <span>· {detail}</span>
    </span>
  );
}

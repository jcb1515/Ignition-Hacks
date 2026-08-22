"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

interface ImportSummary {
  vendors: number; transactions: number; periods: number;
  rowsRead: number; rowsSkipped: number; warnings: string[];
}

/**
 * Bring your own spend. Drop a CSV or JSON export here, the seeded data is
 * replaced, and Run audit works on it. The sample file is a ready-made
 * spreadsheet with anomalies planted, for anyone who wants to edit rather than
 * start from scratch.
 */
export default function UploadPanel({
  onImported,
  disabled,
}: {
  onImported: (summary: ImportSummary) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("replace", "true");
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "import failed");
      setSummary(body);
      await onImported(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
      }}
      className={`rounded-2xl border-2 border-dashed p-5 shadow-sm transition-all sm:p-6 ${drag ? "scale-[1.01] border-azure bg-azure/15 shadow-lg shadow-azure/10" : "border-azure/60 bg-gradient-to-br from-azure/10 via-card to-card hover:border-azure hover:shadow-lg hover:shadow-azure/10"}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-azure text-white shadow-md shadow-azure/25">
            <FileUp size={18} />
          </span>
          <div>
            <p className="text-base font-semibold text-on-card">Try it on your own spend</p>
            <p className="mt-1 text-xs leading-snug text-muted">
              Drop a CSV or JSON export (bank, Brex, Ramp, QuickBooks, or any spreadsheet saved as CSV).
              Needs <code className="font-mono">vendor, amount, date</code>; add{" "}
              <code className="font-mono">category, seats, active_seats</code> for every detector.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href="/sample-spend.csv"
            download
            className="border border-border-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-colors hover:border-azure hover:text-on-card"
          >
            Sample CSV
          </a>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-azure px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-azure/25 transition-all hover:-translate-y-0.5 hover:bg-sky hover:shadow-xl hover:shadow-azure/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
            {busy ? "Importing..." : "Upload file"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && <p className="mt-3 font-mono text-xs text-red">{error}</p>}
      {summary && (
        <div className="mt-3 font-mono text-xs text-muted">
          <p className="text-on-card">
            Imported {summary.vendors} vendors, {summary.transactions} monthly totals across {summary.periods}{" "}
            {summary.periods === 1 ? "period" : "periods"} from {summary.rowsRead} rows
            {summary.rowsSkipped ? ` (${summary.rowsSkipped} skipped)` : ""}. Now press <strong>Run audit</strong>.
          </p>
          {summary.warnings.map((w) => (
            <p key={w} className="mt-1">· {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Bring-your-own-data import.
 *
 * A judge — or a founder — exports vendor spend from their bank, Brex, Ramp,
 * QuickBooks or a spreadsheet, drops the file on the dashboard, and the same
 * four agents run against it. Accepts CSV (export any spreadsheet as CSV) or
 * JSON. One row per vendor per billing period.
 *
 * Required columns (aliases accepted, case-insensitive):
 *   vendor    vendor | merchant | name | description | payee
 *   amount    amount | cost | total | monthly_cost | spend
 *   date      date | period | month | billing_period
 * Optional, used by specific detectors when present:
 *   category        peers for the "overpriced" detector (default: Other)
 *   seats           provisioned seats   ─┐ usage-drift detector
 *   active_seats    seats in use        ─┘
 *   function_tag    what the tool does; the duplicate detector groups on it
 *                   (guessed from the vendor name when absent)
 *   contract_terms, contact_email
 *
 * Dates are bucketed to the first of their month, because the classifier
 * compares billing periods, not individual charges. Multiple charges from the
 * same vendor in one month are summed.
 */
import { resetDb } from "@/lib/db";
import { getVendor, upsertTransaction, upsertVendor } from "@/lib/db/queries";
import { functionTagFor, slug } from "@/lib/integrations/sync";

export interface SpendRow {
  vendor: string;
  amount: number;
  date: string; // YYYY-MM-01
  category?: string;
  seats?: number;
  activeSeats?: number;
  functionTag?: string;
  contractTerms?: string;
  contactEmail?: string;
}

export interface ImportResult {
  vendors: number;
  transactions: number;
  periods: number;
  rowsRead: number;
  rowsSkipped: number;
  warnings: string[];
}

const ALIASES: Record<keyof SpendRow, string[]> = {
  vendor: ["vendor", "merchant", "name", "description", "payee", "vendor_name", "vendorname"],
  amount: ["amount", "cost", "total", "monthly_cost", "monthlycost", "spend", "charge", "price"],
  date: ["date", "period", "month", "billing_period", "billingperiod", "posted", "transaction_date"],
  category: ["category", "type", "department"],
  seats: ["seats", "licenses", "licences", "provisioned_seats"],
  activeSeats: ["active_seats", "activeseats", "active", "used_seats", "seats_used"],
  functionTag: ["function_tag", "functiontag", "function", "tag"],
  contractTerms: ["contract_terms", "contractterms", "contract", "terms", "billing"],
  contactEmail: ["contact_email", "contactemail", "email", "billing_email"],
};

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/^﻿/, "").replace(/[\s-]+/g, "_");
}

/** RFC-4180-ish CSV: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(norm);
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function pick(rec: Record<string, unknown>, key: keyof SpendRow): unknown {
  const keys = Object.keys(rec);
  for (const alias of ALIASES[key]) {
    const k = keys.find((x) => norm(x) === alias);
    if (k !== undefined && rec[k] !== "" && rec[k] !== null && rec[k] !== undefined) return rec[k];
  }
  return undefined;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : undefined;
}

/** "2026-01-15", "01/15/2026", "Jan 2026", "2026-01" → "2026-01-01". */
function toPeriod(v: unknown): string | undefined {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-01`;
  if (typeof v !== "string" || !v.trim()) return undefined;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-01`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return undefined;
}

/** Turns raw records (from CSV or JSON) into validated rows, collecting reasons for skips. */
export function normaliseRows(records: Record<string, unknown>[]): { rows: SpendRow[]; skipped: number; warnings: string[] } {
  const rows: SpendRow[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  records.forEach((rec, i) => {
    const vendor = pick(rec, "vendor");
    const amount = toNumber(pick(rec, "amount"));
    const date = toPeriod(pick(rec, "date"));
    if (typeof vendor !== "string" || !vendor.trim() || amount === undefined || !date) {
      skipped += 1;
      if (warnings.length < 5) warnings.push(`Row ${i + 2}: needs vendor, amount and date (got ${JSON.stringify(rec).slice(0, 80)})`);
      return;
    }
    const category = pick(rec, "category");
    const seats = toNumber(pick(rec, "seats"));
    const activeSeats = toNumber(pick(rec, "activeSeats"));
    const functionTag = pick(rec, "functionTag");
    const contractTerms = pick(rec, "contractTerms");
    const contactEmail = pick(rec, "contactEmail");
    rows.push({
      vendor: vendor.trim(),
      amount: Math.abs(amount),
      date,
      category: typeof category === "string" && category.trim() ? category.trim() : undefined,
      seats, activeSeats,
      functionTag: typeof functionTag === "string" && functionTag.trim() ? functionTag.trim() : undefined,
      contractTerms: typeof contractTerms === "string" && contractTerms.trim() ? contractTerms.trim() : undefined,
      contactEmail: typeof contactEmail === "string" && contactEmail.includes("@") ? contactEmail.trim() : undefined,
    });
  });
  return { rows, skipped, warnings };
}

/** Parses a file body by name/content. JSON may be an array or { transactions: [...] } / { rows: [...] }. */
export function parseSpendFile(text: string, filename = ""): Record<string, unknown>[] {
  const trimmed = text.trim();
  const looksJson = filename.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{");
  if (looksJson) {
    const data = JSON.parse(trimmed) as unknown;
    const arr = Array.isArray(data)
      ? data
      : data && typeof data === "object"
        ? ((data as Record<string, unknown>).transactions ?? (data as Record<string, unknown>).rows ?? (data as Record<string, unknown>).data)
        : undefined;
    if (!Array.isArray(arr)) throw new Error("JSON must be an array of rows, or an object with a transactions/rows array");
    return arr.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  }
  return parseCsv(text);
}

/**
 * Writes rows into the vendors/transactions tables. With `replace` (default)
 * the seeded demo data is cleared first so the audit is purely on the
 * uploaded spend; without it the upload merges into whatever is there.
 */
export function importSpendRows(rows: SpendRow[], opts: { replace?: boolean } = {}): Omit<ImportResult, "rowsRead" | "rowsSkipped" | "warnings"> {
  if (opts.replace ?? true) resetDb();

  const byVendor = new Map<string, SpendRow[]>();
  for (const r of rows) {
    const list = byVendor.get(r.vendor) ?? [];
    list.push(r);
    byVendor.set(r.vendor, list);
  }

  const periods = new Set<string>();
  let transactions = 0;
  for (const [name, list] of byVendor) {
    const id = `upload-${slug(name)}`;
    const byMonth = new Map<string, number>();
    for (const r of list) byMonth.set(r.date, (byMonth.get(r.date) ?? 0) + r.amount);
    const months = [...byMonth.keys()].sort();
    const latest = months.at(-1)!;
    // Metadata: the most recently dated row that carries a value wins.
    const meta = (k: keyof SpendRow) => [...list].sort((a, b) => b.date.localeCompare(a.date)).find((r) => r[k] !== undefined)?.[k];

    const existing = getVendor(id);
    upsertVendor({
      id,
      name,
      category: (meta("category") as string | undefined) ?? existing?.category ?? "Other",
      monthlyCost: Math.round(byMonth.get(latest)! * 100) / 100,
      contractTerms: (meta("contractTerms") as string | undefined) ?? existing?.contractTerms ?? "Unknown (uploaded)",
      lastContactDate: latest,
      contactEmail: (meta("contactEmail") as string | undefined) ?? existing?.contactEmail ?? `billing@${slug(name).replace(/-/g, "")}.com`,
      status: "safe",
      functionTag: (meta("functionTag") as string | undefined) ?? existing?.functionTag ?? functionTagFor(name),
      seats: (meta("seats") as number | undefined) ?? existing?.seats ?? 0,
      activeSeats: (meta("activeSeats") as number | undefined) ?? existing?.activeSeats ?? 0,
    });

    for (const month of months) {
      periods.add(month);
      upsertTransaction({
        id: `${id}-${month}`,
        vendorId: id,
        vendorName: name,
        amount: Math.round(byMonth.get(month)! * 100) / 100,
        date: month,
        source: "Upload",
        flagged: false,
      });
      transactions += 1;
    }
  }

  return { vendors: byVendor.size, transactions, periods: periods.size };
}

/** One call from file text to database. */
export function importSpendFile(text: string, filename = "", opts: { replace?: boolean } = {}): ImportResult {
  const records = parseSpendFile(text, filename);
  if (records.length === 0) throw new Error("No rows found. Expected a header row plus at least one data row.");
  const { rows, skipped, warnings } = normaliseRows(records);
  if (rows.length === 0) {
    throw new Error(`None of the ${records.length} rows had a vendor, amount and date. Columns seen: ${Object.keys(records[0]).join(", ")}`);
  }
  const written = importSpendRows(rows, opts);
  if (written.periods < 2) warnings.push("Only one billing period — the price-creep detector needs at least two months per vendor.");
  if (!rows.some((r) => r.seats)) warnings.push("No seats / active_seats columns — the usage-drift detector has nothing to act on.");
  return { ...written, rowsRead: records.length, rowsSkipped: skipped, warnings };
}

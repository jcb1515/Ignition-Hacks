import { db } from "./index";
import type {
  AgentAction,
  AgentName,
  ForecastSnapshot,
  Transaction,
  Vendor,
  VendorStatus,
} from "@/lib/types";

/* ---------- row mappers ---------- */

type VendorRow = {
  id: string; name: string; category: string; monthly_cost: number;
  contract_terms: string; last_contact_date: string; contact_email: string;
  status: string; function_tag: string; seats: number; active_seats: number;
};

function toVendor(r: VendorRow): Vendor {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    monthlyCost: r.monthly_cost,
    contractTerms: r.contract_terms,
    lastContactDate: r.last_contact_date,
    contactEmail: r.contact_email,
    status: r.status as VendorStatus,
    functionTag: r.function_tag,
    seats: r.seats,
    activeSeats: r.active_seats,
  };
}

type TxRow = {
  id: string; vendor_id: string; vendor_name: string; amount: number;
  date: string; source: string; flagged: number; reason: string | null;
  confidence: number | null; features: string | null;
};

function toTransaction(r: TxRow): Transaction {
  return {
    id: r.id,
    vendorId: r.vendor_id,
    vendorName: r.vendor_name,
    amount: r.amount,
    date: r.date,
    source: r.source as Transaction["source"],
    flagged: r.flagged === 1,
    reason: r.reason ?? undefined,
    confidence: r.confidence ?? undefined,
    features: r.features ?? undefined,
  };
}

type ActionRow = {
  id: string; timestamp: string; agent: string; type: string;
  target: string | null; reasoning: string; human_approved: number;
  approval_required: number; dollar_impact: number;
};

function toAction(r: ActionRow): AgentAction {
  return {
    id: r.id,
    timestamp: r.timestamp,
    agent: r.agent as AgentName,
    type: r.type,
    target: r.target ?? undefined,
    reasoning: r.reasoning,
    humanApproved: r.human_approved === 1,
    approvalRequired: r.approval_required === 1,
    dollarImpact: r.dollar_impact,
  };
}

/* ---------- vendors ---------- */

export function getVendors(): Vendor[] {
  return (db().prepare("SELECT * FROM vendors ORDER BY monthly_cost DESC").all() as VendorRow[]).map(toVendor);
}

export function getVendor(id: string): Vendor | undefined {
  const row = db().prepare("SELECT * FROM vendors WHERE id = ?").get(id) as VendorRow | undefined;
  return row ? toVendor(row) : undefined;
}

export function insertVendor(v: Vendor): void {
  db().prepare(`
    INSERT INTO vendors (id, name, category, monthly_cost, contract_terms,
                         last_contact_date, contact_email, status, function_tag, seats, active_seats)
    VALUES (@id, @name, @category, @monthlyCost, @contractTerms,
            @lastContactDate, @contactEmail, @status, @functionTag, @seats, @activeSeats)
  `).run(v);
}

export function setVendorStatus(id: string, status: VendorStatus): void {
  db().prepare("UPDATE vendors SET status = ? WHERE id = ?").run(status, id);
}

/* ---------- transactions ---------- */

export function getTransactions(): Transaction[] {
  return (db().prepare("SELECT * FROM transactions ORDER BY date DESC").all() as TxRow[]).map(toTransaction);
}

export function getFlaggedTransactions(): Transaction[] {
  return (db().prepare("SELECT * FROM transactions WHERE flagged = 1 ORDER BY date DESC").all() as TxRow[]).map(toTransaction);
}

/** Most recent billing period only — what the classifier actually audits. */
export function getLatestPeriodTransactions(): Transaction[] {
  const latest = db().prepare("SELECT MAX(date) as d FROM transactions").get() as { d: string | null };
  if (!latest.d) return [];
  return (db().prepare("SELECT * FROM transactions WHERE date = ? ORDER BY amount DESC").all(latest.d) as TxRow[]).map(toTransaction);
}

export function getTransactionsForVendor(vendorId: string): Transaction[] {
  return (db().prepare("SELECT * FROM transactions WHERE vendor_id = ? ORDER BY date ASC").all(vendorId) as TxRow[]).map(toTransaction);
}

export function insertTransaction(t: Transaction): void {
  db().prepare(`
    INSERT INTO transactions (id, vendor_id, vendor_name, amount, date, source, flagged, reason, confidence, features)
    VALUES (@id, @vendorId, @vendorName, @amount, @date, @source, @flagged, @reason, @confidence, @features)
  `).run({
    ...t,
    flagged: t.flagged ? 1 : 0,
    reason: t.reason ?? null,
    confidence: t.confidence ?? null,
    features: t.features ?? null,
  });
}

export function flagTransaction(
  id: string, reason: string, confidence: number, features: string
): void {
  db().prepare(
    "UPDATE transactions SET flagged = 1, reason = ?, confidence = ?, features = ? WHERE id = ?"
  ).run(reason, confidence, features, id);
}

export function clearFlags(): void {
  db().prepare("UPDATE transactions SET flagged = 0, reason = NULL, confidence = NULL, features = NULL").run();
}

/* ---------- agent actions ---------- */

export function getActions(limit = 100): AgentAction[] {
  return (db().prepare("SELECT * FROM agent_actions ORDER BY timestamp DESC, rowid DESC LIMIT ?").all(limit) as ActionRow[]).map(toAction);
}

export function insertAction(a: AgentAction): void {
  db().prepare(`
    INSERT INTO agent_actions (id, timestamp, agent, type, target, reasoning,
                               human_approved, approval_required, dollar_impact)
    VALUES (@id, @timestamp, @agent, @type, @target, @reasoning,
            @humanApproved, @approvalRequired, @dollarImpact)
  `).run({
    ...a,
    target: a.target ?? null,
    humanApproved: a.humanApproved ? 1 : 0,
    approvalRequired: a.approvalRequired ? 1 : 0,
  });
}

export function approveAction(id: string): void {
  db().prepare("UPDATE agent_actions SET human_approved = 1 WHERE id = ?").run(id);
}

/* ---------- forecast ---------- */

export function insertSnapshot(s: ForecastSnapshot): void {
  db().prepare(`
    INSERT INTO forecast_snapshots (id, date, burn_rate, runway_months, scenario_label)
    VALUES (@id, @date, @burnRate, @runwayMonths, @scenarioLabel)
  `).run(s);
}

export function getSnapshots(): ForecastSnapshot[] {
  return db().prepare(`
    SELECT id, date, burn_rate as burnRate, runway_months as runwayMonths,
           scenario_label as scenarioLabel
    FROM forecast_snapshots ORDER BY date DESC
  `).all() as ForecastSnapshot[];
}

/* ---------- drafts ---------- */

export interface Draft {
  id: string; vendorId: string; subject: string; body: string;
  toEmail: string; createdAt: string; approved: boolean; sent: boolean;
}

export function insertDraft(d: Draft): void {
  db().prepare(`
    INSERT INTO drafts (id, vendor_id, subject, body, to_email, created_at, approved, sent)
    VALUES (@id, @vendorId, @subject, @body, @toEmail, @createdAt, @approved, @sent)
  `).run({ ...d, approved: d.approved ? 1 : 0, sent: d.sent ? 1 : 0 });
}

export function getDrafts(): Draft[] {
  const rows = db().prepare("SELECT * FROM drafts ORDER BY created_at DESC").all() as Array<{
    id: string; vendor_id: string; subject: string; body: string;
    to_email: string; created_at: string; approved: number; sent: number;
  }>;
  return rows.map((r) => ({
    id: r.id, vendorId: r.vendor_id, subject: r.subject, body: r.body,
    toEmail: r.to_email, createdAt: r.created_at,
    approved: r.approved === 1, sent: r.sent === 1,
  }));
}

export function approveDraft(id: string): void {
  db().prepare("UPDATE drafts SET approved = 1 WHERE id = ?").run(id);
}

export function markDraftSent(id: string): void {
  db().prepare("UPDATE drafts SET sent = 1 WHERE id = ?").run(id);
}

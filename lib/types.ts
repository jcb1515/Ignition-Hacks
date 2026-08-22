// Core domain types for Burn Shield.
// Mirrors the four-table schema in lib/db/schema.sql.

export type VendorStatus = "safe" | "flagged" | "negotiating" | "cancelled";
export type Source = "Plaid" | "Stripe" | "Upload";
export type AgentName = "Classifier" | "Negotiator" | "Forecast" | "Orchestrator";

export interface Vendor {
  id: string;
  name: string;
  category: string;
  monthlyCost: number;
  contractTerms: string;
  lastContactDate: string;
  contactEmail: string;
  status: VendorStatus;
  /**
   * What the tool actually does, independent of billing category. Two vendors
   * are only substitutes if they share a function tag — "Productivity" covers
   * both a wiki and an issue tracker, which are not interchangeable.
   */
  functionTag: string;
  /** Seats or API units provisioned, used for usage-vs-cost drift detection. */
  seats: number;
  /** Seats or units actually active in the last billing period. */
  activeSeats: number;
}

export interface Transaction {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  date: string;
  source: Source;
  flagged: boolean;
  reason?: string;
  confidence?: number;
  /** JSON-encoded FeatureBreakdown[], written by the Classifier. */
  features?: string;
}

export interface AgentAction {
  id: string;
  timestamp: string;
  agent: AgentName;
  type: string;
  target?: string;
  reasoning: string;
  humanApproved: boolean;
  /** Null while a human decision is still outstanding. */
  approvalRequired: boolean;
  dollarImpact: number;
}

export interface ForecastSnapshot {
  id: string;
  date: string;
  burnRate: number;
  runwayMonths: number;
  scenarioLabel: string;
}

/** One contributing signal in a classifier decision. SHAP-style: signed contribution to the score. */
export interface FeatureBreakdown {
  feature: string;
  /** Human-readable value of the raw signal, e.g. "2.37x category mean". */
  value: string;
  /** Signed contribution to the final confidence score, in [-1, 1]. */
  contribution: number;
}

export interface Flag {
  transactionId: string;
  vendorId: string;
  vendorName: string;
  kind: "overpriced" | "duplicate" | "usage_drift" | "price_creep" | "billing_spike";
  confidence: number;
  features: FeatureBreakdown[];
  /** Deterministic one-line summary. The LLM expands this into prose. */
  headline: string;
  monthlyCost: number;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

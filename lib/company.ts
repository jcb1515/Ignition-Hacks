/**
 * Company constants for the seeded startup. The Forecast Agent needs the
 * non-vendor side of burn (payroll, rent) to produce a runway number that
 * isn't nonsense, and the Classifier needs headcount to detect seat
 * double-provisioning across duplicate tools.
 */
export const COMPANY = {
  name: "Northwind Labs",
  headcount: 12,
  /** Fully-loaded payroll + benefits, monthly. */
  payroll: 78_000,
  /** Rent, insurance, everything that isn't payroll or a tracked vendor. */
  overhead: 6_000,
  /** Cash in the bank at the start of the projection. */
  cashOnHand: 900_000,
  /** Monthly recurring revenue, from Stripe. Offsets burn. */
  mrr: 14_500,
} as const;

/** Dollar threshold above which the Orchestrator will not act without a human. */
export const APPROVAL_THRESHOLD = Number(process.env.APPROVAL_THRESHOLD ?? 1_000);

/** When true, agents never make a network call. Deterministic, demo-safe. */
export const DEMO_MODE = process.env.DEMO_MODE !== "false";

/**
 * Delay between streamed audit events, in milliseconds.
 *
 * The whole audit computes in well under a second, which on screen means the
 * action log appears fully-formed in one frame — which reads as a scripted
 * animation rather than an agent working. Pacing the stream lets the log build
 * while the presenter narrates. Set to 0 in tests so they stay fast.
 */
export const AUDIT_PACE_MS = Number(process.env.AUDIT_PACE_MS ?? (DEMO_MODE ? 160 : 0));

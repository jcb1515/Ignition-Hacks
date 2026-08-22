/**
 * CLI entry point for seeding. The data and the logic live in lib/db/seed.ts so
 * the dashboard's Reseed button and first-open auto-seed use the same code.
 */
import { seed, SEED_PERIODS } from "../lib/db/seed";

const r = seed();
console.log(`Seeded ${r.vendors} vendors, ${r.transactions} transactions across ${SEED_PERIODS} periods.`);
console.log(`Latest-period vendor spend: $${Math.round(r.latestSpend).toLocaleString()}/mo`);
console.log(`Flagged transactions in seed: 0 (by design — the Classifier must find them)`);

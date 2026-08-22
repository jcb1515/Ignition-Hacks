import Database from "better-sqlite3";
import { accessSync, constants, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Where the SQLite file lives. Serverless hosts (Vercel, Lambda) mount the
 * bundle read-only, so `./runway.db` cannot be created there and every write
 * fails with "unable to open database file". Fall back to the OS temp dir
 * when the working directory is not writable. That database is per-instance
 * and ephemeral — fine for a demo, and auto-seed below fills it on first open.
 */
function databasePath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  try {
    accessSync(process.cwd(), constants.W_OK);
    return join(process.cwd(), "runway.db");
  } catch {
    return join(tmpdir(), "runway.db");
  }
}

let _db: Database.Database | null = null;

/**
 * Single shared connection. The schema is applied on first open and an empty
 * database is seeded automatically, so a fresh checkout works with just
 * `npm run dev`.
 */
export function db(): Database.Database {
  if (_db) return _db;

  const path = databasePath();
  const conn = new Database(path);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");

  const schema = readFileSync(join(process.cwd(), "lib", "db", "schema.sql"), "utf8");
  conn.exec(schema);

  _db = conn;

  // A fresh clone that was never seeded shows an empty dashboard, which reads
  // as "broken" rather than "empty". Seed demo data on first open instead.
  // `npm run seed` still works and still resets to the same bytes.
  const { n } = conn.prepare("SELECT COUNT(*) AS n FROM vendors").get() as { n: number };
  if (n === 0 && process.env.AUTO_SEED !== "false") {
    // Imported lazily: seed.ts imports this module, so a top-level import
    // would be a cycle evaluated before `db` exists.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seed } = require("./seed") as typeof import("./seed");
    seed();
  }

  return _db;
}

/** Drops all rows. Used by the seed script and the smoke test. */
export function resetDb(): void {
  const conn = db();
  conn.exec(`
    DELETE FROM settings;
    DELETE FROM drafts;
    DELETE FROM forecast_snapshots;
    DELETE FROM agent_actions;
    DELETE FROM transactions;
    DELETE FROM vendors;
  `);
}

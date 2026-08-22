import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let _db: Database.Database | null = null;

/**
 * Single shared connection. The schema is applied on first open, so a fresh
 * checkout works with no migration step: `npm run seed` is enough.
 */
export function db(): Database.Database {
  if (_db) return _db;

  const path = process.env.DATABASE_PATH ?? join(process.cwd(), "runway.db");
  const conn = new Database(path);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");

  const schema = readFileSync(join(process.cwd(), "lib", "db", "schema.sql"), "utf8");
  conn.exec(schema);

  _db = conn;
  return _db;
}

/** Drops all rows. Used by the seed script and the smoke test. */
export function resetDb(): void {
  const conn = db();
  conn.exec(`
    DELETE FROM drafts;
    DELETE FROM forecast_snapshots;
    DELETE FROM agent_actions;
    DELETE FROM transactions;
    DELETE FROM vendors;
  `);
}

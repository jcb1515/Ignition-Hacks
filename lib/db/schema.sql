-- Runway Radar schema. Four tables, matching context.md.

CREATE TABLE IF NOT EXISTS vendors (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  monthly_cost      REAL NOT NULL,
  contract_terms    TEXT NOT NULL,
  last_contact_date TEXT NOT NULL,
  contact_email     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'safe',
  function_tag      TEXT NOT NULL DEFAULT 'other',
  seats             INTEGER NOT NULL DEFAULT 0,
  active_seats      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  vendor_id   TEXT NOT NULL REFERENCES vendors(id),
  vendor_name TEXT NOT NULL,
  amount      REAL NOT NULL,
  date        TEXT NOT NULL,
  source      TEXT NOT NULL,
  flagged     INTEGER NOT NULL DEFAULT 0,
  reason      TEXT,
  confidence  REAL,
  features    TEXT
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id                TEXT PRIMARY KEY,
  timestamp         TEXT NOT NULL,
  agent             TEXT NOT NULL,
  type              TEXT NOT NULL,
  target            TEXT,
  reasoning         TEXT NOT NULL,
  human_approved    INTEGER NOT NULL DEFAULT 0,
  approval_required INTEGER NOT NULL DEFAULT 0,
  dollar_impact     REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS forecast_snapshots (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL,
  burn_rate      REAL NOT NULL,
  runway_months  REAL NOT NULL,
  scenario_label TEXT NOT NULL
);

-- Drafted emails live alongside actions so the dashboard can show the artifact,
-- not just the log line that says an artifact was produced.
CREATE TABLE IF NOT EXISTS drafts (
  id         TEXT PRIMARY KEY,
  vendor_id  TEXT NOT NULL REFERENCES vendors(id),
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  to_email   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved   INTEGER NOT NULL DEFAULT 0,
  sent       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tx_vendor ON transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tx_date   ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_act_ts    ON agent_actions(timestamp);

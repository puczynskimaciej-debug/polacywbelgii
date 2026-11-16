-- Apply once, only after a verified backup. TEST first; never apply to production by default.
ALTER TABLE contact_messages ADD COLUMN closed_at TEXT;
CREATE INDEX IF NOT EXISTS contact_messages_closed ON contact_messages(closed_at);

CREATE TABLE IF NOT EXISTS retention_policy (
  category TEXT PRIMARY KEY CHECK(category IN ('contact','ai_history','sessions','security_logs','unpaid_orders','paid_orders')),
  period_days INTEGER CHECK(period_days IS NULL OR period_days >= 0),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Owner-approved operational periods; production automatic execution remains disabled.
INSERT INTO retention_policy(category,period_days,enabled) VALUES
 ('contact',365,1),('ai_history',30,1),('sessions',0,1),
 ('security_logs',90,1),('unpaid_orders',365,1),('paid_orders',NULL,0);

CREATE TABLE IF NOT EXISTS retention_holds (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('contact','ai_conversation','ad_group')),
  entity_id TEXT NOT NULL,
  reason_code TEXT NOT NULL CHECK(reason_code IN ('open_case','complaint','dispute','tax','legal_other')),
  until_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  released_at TEXT,
  PRIMARY KEY(entity_type,entity_id)
);

CREATE TABLE IF NOT EXISTS retention_lock (
  id INTEGER PRIMARY KEY CHECK(id=1),
  owner TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
INSERT OR IGNORE INTO retention_lock(id,owner,expires_at) VALUES(1,'','1970-01-01T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS retention_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed')),
  counts_json TEXT NOT NULL DEFAULT '{}',
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS retention_runs_started ON retention_runs(started_at DESC);

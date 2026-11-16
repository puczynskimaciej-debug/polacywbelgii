-- Additive migration. Apply after 0004; TEST first, after a verified backup.
-- The range is an incident/evidence hold, not a copy of log contents.
CREATE TABLE IF NOT EXISTS security_log_holds (
  id TEXT PRIMARY KEY,
  reason_code TEXT NOT NULL CHECK(reason_code IN ('incident','legal_evidence')),
  start_at TEXT NOT NULL,
  end_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  released_at TEXT,
  CHECK(end_at IS NULL OR end_at >= start_at)
);
CREATE INDEX IF NOT EXISTS security_log_holds_active_range ON security_log_holds(released_at,start_at,end_at);

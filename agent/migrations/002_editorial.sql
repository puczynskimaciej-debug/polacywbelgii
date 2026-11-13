-- Additive migration: preserve existing CMS users, articles, and AI candidates.
CREATE TABLE IF NOT EXISTS ai_editorial (
  candidate_id TEXT PRIMARY KEY REFERENCES ai_candidates(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('draft','pending_review','changes_requested','approved','scheduled','published','rejected','archived')),
  owner_kind TEXT NOT NULL DEFAULT 'agent' CHECK(owner_kind IN ('agent','admin')),
  owner_id TEXT NOT NULL DEFAULT 'agent',
  proposed_publish_at TEXT,
  scheduled_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  published_at TEXT,
  public_state TEXT NOT NULL DEFAULT 'hidden' CHECK(public_state IN ('hidden','visible','withdraw_requested')),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_editorial_due ON ai_editorial(status,scheduled_at);
CREATE UNIQUE INDEX IF NOT EXISTS ai_editorial_unique_slot ON ai_editorial(scheduled_at) WHERE status='scheduled';
INSERT OR IGNORE INTO ai_editorial(candidate_id,status,owner_kind,owner_id,updated_at)
SELECT id,CASE WHEN status IN ('draft','pending_review','rejected') THEN status ELSE 'pending_review' END,'agent','agent',updated_at FROM ai_candidates;
INSERT OR IGNORE INTO ai_config(key,value_json,updated_at) VALUES('editorial', '{"dailyTarget":2,"dailyMax":3,"slots":["08:00","17:00","12:00"],"bufferDays":7,"maxPending":21}', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

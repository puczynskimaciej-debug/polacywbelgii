CREATE TABLE IF NOT EXISTS ai_chat_entries (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','agent')),
  body TEXT NOT NULL,
  job_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_chat_entries_conversation ON ai_chat_entries(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS ai_chat_jobs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','done','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  candidate_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_chat_jobs_queue ON ai_chat_jobs(status,created_at);

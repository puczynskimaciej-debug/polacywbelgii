-- Conversation revisions and quota backoff. Existing drafts and messages remain intact.
CREATE TABLE IF NOT EXISTS ai_chat_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(conversation_id,version)
);
CREATE INDEX IF NOT EXISTS ai_chat_versions_conversation ON ai_chat_versions(conversation_id,version DESC);
ALTER TABLE ai_chat_jobs ADD COLUMN not_before TEXT;
CREATE TABLE IF NOT EXISTS ai_morning_runs (
  local_day TEXT PRIMARY KEY,
  queued_at TEXT NOT NULL,
  topic_count INTEGER NOT NULL CHECK(topic_count BETWEEN 0 AND 3)
);

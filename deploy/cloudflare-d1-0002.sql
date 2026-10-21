-- Run after cloudflare-d1.sql. Serialized ad writes use this append-only
-- version table so concurrent reservations cannot consume the same final slot.
CREATE TABLE IF NOT EXISTS ad_write_versions (
  version INTEGER PRIMARY KEY CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS contact_messages_created ON contact_messages(created_at DESC);

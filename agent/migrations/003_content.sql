-- Shared CMS store. Existing GitHub/static files remain untouched during migration.
CREATE TABLE IF NOT EXISTS cms_content (
  path TEXT PRIMARY KEY,
  sha TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('article','media','config')),
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cms_content_chunks (
  path TEXT NOT NULL REFERENCES cms_content(path) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY(path, position)
);
CREATE TABLE IF NOT EXISTS cms_content_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  sha TEXT,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  at TEXT NOT NULL,
  content TEXT
);
CREATE INDEX IF NOT EXISTS cms_content_history_path ON cms_content_history(path, id DESC);
CREATE INDEX IF NOT EXISTS cms_content_kind_status ON cms_content(kind,status);

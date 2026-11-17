-- Publication metadata stays separate from article text and images.
CREATE TABLE IF NOT EXISTS cms_article_publication (
  path TEXT PRIMARY KEY REFERENCES cms_content(path) ON DELETE CASCADE,
  scheduled_at TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (scheduled_at IS NULL OR published_at IS NULL)
);
CREATE INDEX IF NOT EXISTS cms_article_publication_due ON cms_article_publication(scheduled_at);

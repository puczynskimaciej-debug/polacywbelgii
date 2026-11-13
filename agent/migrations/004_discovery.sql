CREATE TABLE IF NOT EXISTS ai_discovery_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('article','event')),
  source_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT NOT NULL,
  candidate_id TEXT,
  error_code TEXT
);
CREATE TABLE IF NOT EXISTS ai_daily_budget (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0 CHECK(calls >= 0)
);
INSERT OR IGNORE INTO ai_sources(id,url,type,language,region,interval_hours,priority,active)
VALUES('gov-belgia-news','https://www.gov.pl/web/belgia/aktualnosci','html','pl','all',12,5,1);
INSERT OR IGNORE INTO ai_sources(id,url,type,language,region,interval_hours,priority,active)
VALUES('institute-brussels-events','https://instytutpolski.pl/brussels/en/','html','en','brussels',12,5,1);

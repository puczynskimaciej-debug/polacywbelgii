-- Apply only to a local/test D1 first. No existing ad rows are modified.
CREATE TABLE IF NOT EXISTS ad_payment_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  group_id TEXT,
  received_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ad_payment_events_group ON ad_payment_events(group_id);
CREATE TABLE IF NOT EXISTS ad_order_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ad_order_history_order ON ad_order_history(order_id);

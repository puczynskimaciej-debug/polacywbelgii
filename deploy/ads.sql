-- Apply once using npm run ads:migrate. All order writes serialize on ads_settings.
CREATE TABLE IF NOT EXISTS ads_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS ad_orders (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_orders_market ON ad_orders ((data->>'language'), (data->>'type'));
CREATE TABLE IF NOT EXISTS ad_rate_limits (
  key text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL
);

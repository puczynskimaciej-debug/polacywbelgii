-- Add a few English sample listings only when no English showcase set exists.
-- Existing orders and the previously published premium banners are untouched.
INSERT INTO ad_orders(id, data)
SELECT samples.id::uuid, jsonb_build_object(
  'id', samples.id, 'version', 1, 'type', samples.placement, 'language', 'en',
  'region', 'all', 'kind', 'text', 'source', 'manual', 'status', 'approved',
  'paymentStatus', 'not_required', 'demoSet', 'showcase-2026-09-29',
  'company', '', 'title', left(samples.description, 70),
  'description', samples.description, 'contact', 'demo@polacywbelgii.eu',
  'customerName', '', 'email', 'demo@polacywbelgii.eu', 'phone', '', 'url', '', 'image', '',
  'startDate', to_char(now() AT TIME ZONE 'Europe/Brussels', 'YYYY-MM-DD'),
  'endDate', to_char((now() AT TIME ZONE 'Europe/Brussels') + interval '29 days', 'YYYY-MM-DD'),
  'days', 30, 'dailyPrice', 0, 'totalPrice', 0, 'currency', 'EUR',
  'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'updatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
)
FROM (VALUES
  ('0ef56b78-7d05-4cce-bd31-2b190f51eb41', 'TOP', 'DEMO · Local restaurant. A sample offer for the Polish community in Belgium.'),
  ('0ef56b78-7d05-4cce-bd31-2b190f51eb42', 'STANDARD', 'DEMO · Intercity transport. A sample listing for journeys across Belgium.'),
  ('0ef56b78-7d05-4cce-bd31-2b190f51eb43', 'STANDARD', 'DEMO · Home renovations. A sample offer from a local business.'),
  ('0ef56b78-7d05-4cce-bd31-2b190f51eb44', 'STANDARD', 'DEMO · Language lessons. A sample listing for newcomers to Belgium.')
) AS samples(id, placement, description)
WHERE NOT EXISTS (
  SELECT 1 FROM ad_orders WHERE data->>'language' = 'en' AND data->>'demoSet' = 'showcase-2026-09-29'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cms_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'editor')),
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cms_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES cms_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cms_sessions_user ON cms_sessions(user_id);
CREATE TABLE IF NOT EXISTS cms_login_limits (
  key text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL
);
CREATE TABLE IF NOT EXISTS cms_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES cms_users(id),
  action text NOT NULL,
  target text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

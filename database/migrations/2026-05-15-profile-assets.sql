-- The Eventus Consulting Group profile/logo backend upgrade.
-- Use this on an existing PostgreSQL database created before profile pictures/client logos.

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS title VARCHAR(120),
  ADD COLUMN IF NOT EXISTS department VARCHAR(120),
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients (name);

COMMENT ON COLUMN users.avatar_url IS 'Profile picture URL or object-storage path for SuperUser and regular users.';
COMMENT ON COLUMN clients.logo_url IS 'Client/customer logo URL or object-storage path used to validate client identity.';

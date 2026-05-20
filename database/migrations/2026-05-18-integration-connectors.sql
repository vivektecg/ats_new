-- The Eventus Consulting Group integration connector settings and sync history.
-- Store production provider secrets on the backend and reference them through secret_reference.

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS connection_mode VARCHAR(80) NOT NULL DEFAULT 'Manual import',
  ADD COLUMN IF NOT EXISTS account_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(180),
  ADD COLUMN IF NOT EXISTS api_base_url TEXT,
  ADD COLUMN IF NOT EXISTS client_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secret_reference TEXT,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS email_provider VARCHAR(120),
  ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255),
  ADD COLUMN IF NOT EXISTS imap_port INTEGER,
  ADD COLUMN IF NOT EXISTS pop_host VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pop_port INTEGER,
  ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255),
  ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
  ADD COLUMN IF NOT EXISTS mail_security VARCHAR(80),
  ADD COLUMN IF NOT EXISTS mailbox_folders TEXT,
  ADD COLUMN IF NOT EXISTS enabled_workflows JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  provider VARCHAR(120) NOT NULL,
  status VARCHAR(80) NOT NULL DEFAULT 'Completed',
  records_synced INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_provider
  ON integration_sync_logs(provider, created_at DESC);

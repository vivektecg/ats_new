-- Frontend/backend workflow integration for CRM logos, submissions, onboarding, email, and documents.

ALTER TABLE candidate_documents
  ADD COLUMN IF NOT EXISTS checklist_checked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS storage_status VARCHAR(80) NOT NULL DEFAULT 'Local ATS metadata',
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS direction VARCHAR(40) NOT NULL DEFAULT 'Outbound',
  ADD COLUMN IF NOT EXISTS mailbox_account_id UUID,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS server_timestamp TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(120) NOT NULL DEFAULT 'Outlook / IMAP',
  email_address VARCHAR(255) NOT NULL,
  imap_host VARCHAR(255) NOT NULL DEFAULT 'outlook.office365.com',
  imap_port INTEGER NOT NULL DEFAULT 993,
  smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.office365.com',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  status VARCHAR(40) NOT NULL DEFAULT 'Connected',
  secret_reference TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE (user_id, email_address)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_email_logs_mailbox_account'
  ) THEN
    ALTER TABLE email_logs
      ADD CONSTRAINT fk_email_logs_mailbox_account
      FOREIGN KEY (mailbox_account_id) REFERENCES user_email_accounts(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS onboarding_task_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_case_id UUID NOT NULL REFERENCES onboarding_cases(id) ON DELETE CASCADE,
  task_id VARCHAR(160) NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  direction VARCHAR(40) NOT NULL CHECK (direction IN ('Sent', 'Received')),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_email_accounts_user
  ON user_email_accounts(user_id, status);

CREATE INDEX IF NOT EXISTS idx_email_logs_candidate_direction
  ON email_logs(candidate_id, direction, sent_at DESC, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_task_documents_case
  ON onboarding_task_documents(onboarding_case_id, task_id, uploaded_at DESC);

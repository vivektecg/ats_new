-- The Eventus Consulting Group onboarding and compliance workflow tables.

CREATE TABLE IF NOT EXISTS onboarding_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),
  status VARCHAR(80) NOT NULL DEFAULT 'In Progress',
  start_date DATE,
  packet_sent_at TIMESTAMPTZ,
  e_signature_status VARCHAR(80) DEFAULT 'Not Sent',
  i9_status VARCHAR(80) DEFAULT 'Pending',
  everify_status VARCHAR(80) DEFAULT 'Pending',
  background_status VARCHAR(80) DEFAULT 'Pending',
  tasks JSONB NOT NULL DEFAULT '[]'::JSONB,
  activity JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS compliance_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),
  status VARCHAR(80) NOT NULL DEFAULT 'Pending',
  risk_level VARCHAR(40) NOT NULL DEFAULT 'Medium',
  checks JSONB NOT NULL DEFAULT '[]'::JSONB,
  activity JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_cases_candidate
  ON onboarding_cases(candidate_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_cases_candidate
  ON compliance_cases(candidate_id, status, risk_level);

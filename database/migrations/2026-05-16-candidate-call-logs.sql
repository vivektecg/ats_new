-- The Eventus Consulting Group candidate quick-call timeline storage.
-- Provider fields are ready for Twilio, RingCentral, Vonage, Teams Phone, or another calling gateway.

CREATE TABLE IF NOT EXISTS candidate_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES users(id),
  phone VARCHAR(40) NOT NULL,
  outcome VARCHAR(80) NOT NULL DEFAULT 'Initiated',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  provider VARCHAR(80) DEFAULT 'ATS Quick Call',
  provider_call_id VARCHAR(180),
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_call_logs_candidate
  ON candidate_call_logs(candidate_id, started_at DESC);

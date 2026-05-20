-- Additional PostgreSQL indexes for ATS JSONB collections.
-- These help candidate/job/submission views stay responsive as the dataset grows.

CREATE INDEX IF NOT EXISTS idx_ats_candidates_phone
  ON ats_records ((regexp_replace(data->>'phone', '\D', '', 'g')))
  WHERE collection = 'candidates'
    AND data ? 'phone';

CREATE INDEX IF NOT EXISTS idx_ats_candidates_status
  ON ats_records ((data->>'status'))
  WHERE collection = 'candidates'
    AND data ? 'status';

CREATE INDEX IF NOT EXISTS idx_ats_jobs_status
  ON ats_records ((data->>'status'))
  WHERE collection = 'jobs'
    AND data ? 'status';

CREATE INDEX IF NOT EXISTS idx_ats_jobs_client_id
  ON ats_records ((data->>'clientId'))
  WHERE collection = 'jobs'
    AND data ? 'clientId';

CREATE INDEX IF NOT EXISTS idx_ats_submissions_candidate_id
  ON ats_records ((data->>'candidateId'))
  WHERE collection = 'submissions'
    AND data ? 'candidateId';

CREATE INDEX IF NOT EXISTS idx_ats_submissions_job_id
  ON ats_records ((data->>'jobId'))
  WHERE collection = 'submissions'
    AND data ? 'jobId';

CREATE INDEX IF NOT EXISTS idx_ats_submissions_status
  ON ats_records ((data->>'status'))
  WHERE collection = 'submissions'
    AND data ? 'status';

-- Production PostgreSQL backing store for the current flexible ATS API contract.
-- Each ATS collection row is stored as JSONB while key workflow constraints are indexed.

CREATE TABLE IF NOT EXISTS ats_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_ats_records_collection_updated
  ON ats_records(collection, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ats_submissions_candidate_job_unique
  ON ats_records ((data->>'candidateId'), (data->>'jobId'))
  WHERE collection = 'submissions'
    AND data ? 'candidateId'
    AND data ? 'jobId';

CREATE INDEX IF NOT EXISTS idx_ats_candidates_email
  ON ats_records ((LOWER(data->>'email')))
  WHERE collection = 'candidates'
    AND data ? 'email';

CREATE INDEX IF NOT EXISTS idx_ats_jobs_external_id
  ON ats_records ((data->>'externalJobId'))
  WHERE collection = 'jobs'
    AND data ? 'externalJobId';

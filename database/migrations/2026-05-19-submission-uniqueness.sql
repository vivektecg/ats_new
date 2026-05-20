-- Enforce one submission per candidate/job while preserving multiple-job submissions.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS submitted_by_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS duplicate_blocked_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submissions_candidate_job_unique'
  ) THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_candidate_job_unique UNIQUE (candidate_id, job_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_candidate_job_submitted_at
  ON submissions(candidate_id, job_id, submitted_at DESC);

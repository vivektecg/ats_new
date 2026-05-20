-- The Eventus Consulting Group job/interview scheduling fields.
-- Adds optional external job IDs, job SPOC/interviewer names, and interview time zones.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS external_job_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS spoc_name VARCHAR(180);

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS time_zone VARCHAR(40);

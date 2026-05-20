-- Import, bulk resume, Excel, and Autopilot sourcing backend readiness.
-- These tables let the VPS backend persist each import run, resume file metadata,
-- mapped spreadsheet rows, scheduled authorized sourcing jobs, and email digests.

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type VARCHAR(40) NOT NULL CHECK (import_type IN ('bulk_resume', 'excel_candidates', 'autopilot')),
  source_name VARCHAR(180),
  source_file_name VARCHAR(255),
  source_file_type VARCHAR(120),
  source_file_size BIGINT,
  status VARCHAR(40) NOT NULL DEFAULT 'Draft',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  warning_rows INTEGER NOT NULL DEFAULT 0,
  mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS import_batches_type_status_idx
  ON import_batches(import_type, status);

CREATE TABLE IF NOT EXISTS import_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  row_number INTEGER,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  warning_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS import_batch_items_batch_idx
  ON import_batch_items(batch_id);

CREATE TABLE IF NOT EXISTS candidate_resume_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(120),
  file_size_bytes BIGINT,
  file_url TEXT,
  resume_version VARCHAR(80) NOT NULL DEFAULT 'Original resume',
  parser_status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  parsed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS candidate_resume_files_candidate_idx
  ON candidate_resume_files(candidate_id);

CREATE TABLE IF NOT EXISTS autopilot_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  boolean_string TEXT NOT NULL,
  countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_locations TEXT,
  time_zone VARCHAR(40) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  profile_limit INTEGER NOT NULL CHECK (profile_limit BETWEEN 1 AND 50),
  source_boards JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_skills TEXT,
  preferred_skills TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Scheduled',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  email_digest_to VARCHAR(255),
  consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS autopilot_schedules_status_next_run_idx
  ON autopilot_schedules(status, next_run_at);

CREATE TABLE IF NOT EXISTS autopilot_fetch_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES autopilot_schedules(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  source_board VARCHAR(120),
  fetched_name VARCHAR(180),
  fetched_email VARCHAR(255),
  fetched_phone VARCHAR(40),
  fetched_location VARCHAR(180),
  fetched_role VARCHAR(180),
  warning_message TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS autopilot_fetch_results_schedule_idx
  ON autopilot_fetch_results(schedule_id);

CREATE TABLE IF NOT EXISTS autopilot_email_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES autopilot_schedules(id) ON DELETE SET NULL,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_markdown TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Queued',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TRIGGER import_batches_set_updated_at
  BEFORE UPDATE ON import_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER import_batch_items_set_updated_at
  BEFORE UPDATE ON import_batch_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER candidate_resume_files_set_updated_at
  BEFORE UPDATE ON candidate_resume_files
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER autopilot_schedules_set_updated_at
  BEFORE UPDATE ON autopilot_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER autopilot_fetch_results_set_updated_at
  BEFORE UPDATE ON autopilot_fetch_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER autopilot_email_digests_set_updated_at
  BEFORE UPDATE ON autopilot_email_digests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

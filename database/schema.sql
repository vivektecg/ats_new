-- The Eventus Consulting Group SQL backend readiness schema
-- Target: PostgreSQL-compatible SQL for a future Express + SQL backend.
-- This file does not connect to any paid service.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE candidate_status AS ENUM ('New', 'Screening', 'Interview', 'Offer', 'Placed', 'Rejected', 'On Hold');
CREATE TYPE job_status AS ENUM ('Active', 'On Hold', 'Filled', 'Cancelled');
CREATE TYPE submission_status AS ENUM ('Submitted', 'Client Review', 'Interview Scheduled', 'Offer Extended', 'Placed', 'Rejected');
CREATE TYPE priority_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE task_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Overdue');
CREATE TYPE compliance_status AS ENUM ('Pending', 'Submitted', 'Approved', 'Expired', 'Rejected');
CREATE TYPE interview_status AS ENUM ('Scheduled', 'Completed', 'Cancelled', 'No Show');
CREATE TYPE offer_status AS ENUM ('Draft', 'Discussion', 'Extended', 'Accepted', 'Declined', 'Withdrawn');
CREATE TYPE placement_status AS ENUM ('Pending Start', 'Joined', 'Backed Out', 'Completed', 'Terminated');
CREATE TYPE notification_status AS ENUM ('Unread', 'Read', 'Archived');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  phone VARCHAR(40),
  avatar_url TEXT,
  title VARCHAR(120),
  department VARCHAR(120),
  status VARCHAR(40) NOT NULL DEFAULT 'Active',
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  password_blocked_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  last_password_reset_email_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_encrypted TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token_hash TEXT NOT NULL,
  requested_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX password_reset_tokens_email_idx ON password_reset_tokens(email);
CREATE INDEX password_reset_tokens_active_idx ON password_reset_tokens(email, expires_at) WHERE used_at IS NULL;

CREATE TABLE email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  template_key VARCHAR(120),
  status VARCHAR(40) NOT NULL DEFAULT 'Queued',
  provider_message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

ALTER TABLE roles
  ADD CONSTRAINT roles_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT roles_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id);

CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(40),
  current_title VARCHAR(180),
  current_company VARCHAR(180),
  location VARCHAR(180),
  skills_summary TEXT,
  total_experience NUMERIC(4,1) DEFAULT 0,
  us_experience NUMERIC(4,1) DEFAULT 0,
  work_authorization VARCHAR(120),
  visa_status VARCHAR(120),
  current_rate VARCHAR(80),
  expected_rate VARCHAR(80),
  availability VARCHAR(120),
  passport_number VARCHAR(120),
  resume_file TEXT,
  supporting_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  source VARCHAR(120),
  owner_id UUID REFERENCES users(id),
  recruiter_id UUID REFERENCES users(id),
  status candidate_status NOT NULL DEFAULT 'New',
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  linkedin_url TEXT,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE candidate_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  skill_name VARCHAR(120) NOT NULL,
  years_experience NUMERIC(4,1),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE (candidate_id, skill_name)
);

CREATE TABLE candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  document_type VARCHAR(120) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT,
  mime_type VARCHAR(120),
  file_size_bytes BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL UNIQUE,
  logo_url TEXT,
  industry VARCHAR(160),
  location VARCHAR(180),
  website TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Active',
  tier VARCHAR(40),
  total_placements INTEGER NOT NULL DEFAULT 0,
  active_jobs INTEGER NOT NULL DEFAULT 0,
  revenue VARCHAR(80),
  owner_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  full_name VARCHAR(180) NOT NULL,
  title VARCHAR(160),
  email VARCHAR(255),
  phone VARCHAR(40),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(180) NOT NULL,
  contact_name VARCHAR(180),
  email VARCHAR(255),
  phone VARCHAR(40),
  client_represented VARCHAR(180),
  submission_format TEXT,
  rate_margin VARCHAR(80),
  payment_terms TEXT,
  agreement_status VARCHAR(80) NOT NULL DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_job_id VARCHAR(120),
  title VARCHAR(180) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  client_contact_id UUID REFERENCES client_contacts(id),
  spoc_name VARCHAR(180),
  location VARCHAR(180),
  work_mode VARCHAR(80),
  job_type VARCHAR(80),
  openings INTEGER NOT NULL DEFAULT 1,
  pay_rate VARCHAR(80),
  bill_rate VARCHAR(80),
  priority priority_level NOT NULL DEFAULT 'Medium',
  status job_status NOT NULL DEFAULT 'Active',
  required_skills TEXT,
  preferred_skills TEXT,
  job_description TEXT,
  jd_attachment_name VARCHAR(255),
  jd_attachment_type VARCHAR(120),
  jd_attachment_size BIGINT,
  jd_attachment_url TEXT,
  submission_deadline DATE,
  tat_due_at DATE,
  tat_days INTEGER,
  assigned_recruiter_id UUID REFERENCES users(id),
  posted_date DATE,
  close_date DATE,
  department VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE job_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  document_type VARCHAR(120) NOT NULL DEFAULT 'JD',
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(120),
  file_size BIGINT,
  storage_url TEXT,
  source VARCHAR(80) DEFAULT 'ATS Upload',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE job_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_name VARCHAR(120) NOT NULL,
  skill_type VARCHAR(40) NOT NULL DEFAULT 'Mandatory',
  years_required NUMERIC(4,1),
  priority priority_level NOT NULL DEFAULT 'Medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE (job_id, skill_name)
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  status submission_status NOT NULL DEFAULT 'Submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_rate VARCHAR(80),
  recruiter_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE (candidate_id, job_id)
);

CREATE TABLE candidate_job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  stage VARCHAR(80) NOT NULL DEFAULT 'Sourced',
  match_score NUMERIC(5,2),
  duplicate_submission_warning TEXT,
  previous_submission_id UUID REFERENCES submissions(id),
  human_decision VARCHAR(80),
  human_decision_by UUID REFERENCES users(id),
  human_decision_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE (candidate_id, job_id)
);

CREATE TABLE resume_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_document_id UUID REFERENCES candidate_documents(id),
  overall_match NUMERIC(5,2),
  mandatory_skills_match NUMERIC(5,2),
  preferred_skills_match NUMERIC(5,2),
  experience_match NUMERIC(5,2),
  domain_match NUMERIC(5,2),
  location_match NUMERIC(5,2),
  visa_match NUMERIC(5,2),
  education_match NUMERIC(5,2),
  certification_match NUMERIC(5,2),
  missing_mandatory_skills TEXT,
  missing_preferred_skills TEXT,
  weak_areas TEXT,
  red_flags TEXT,
  improvement_suggestions TEXT,
  recruiter_summary TEXT,
  client_submission_summary TEXT,
  screening_questions TEXT,
  ai_recommendation VARCHAR(80),
  human_final_decision VARCHAR(80),
  human_final_decision_by UUID REFERENCES users(id),
  human_final_decision_at TIMESTAMPTZ,
  ai_disclaimer TEXT NOT NULL DEFAULT 'AI can recommend, score, summarize, and flag gaps, but final decision must always be made by a human recruiter.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE ai_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::JSONB,
  recommendation VARCHAR(80),
  explanation TEXT,
  generated_by UUID REFERENCES users(id),
  human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE (candidate_id, job_id)
);

CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  job_id UUID REFERENCES jobs(id),
  client_id UUID REFERENCES clients(id),
  interview_type VARCHAR(80) NOT NULL,
  interview_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  interviewer VARCHAR(180),
  time_zone VARCHAR(40),
  meeting_link TEXT,
  status interview_status NOT NULL DEFAULT 'Scheduled',
  feedback TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  submission_id UUID REFERENCES submissions(id),
  status offer_status NOT NULL DEFAULT 'Draft',
  pay_rate VARCHAR(80),
  bill_rate VARCHAR(80),
  salary VARCHAR(80),
  start_date DATE,
  offer_sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  offer_id UUID REFERENCES offers(id),
  status placement_status NOT NULL DEFAULT 'Pending Start',
  start_date DATE,
  end_date DATE,
  pay_rate VARCHAR(80),
  bill_rate VARCHAR(80),
  margin VARCHAR(80),
  revenue_forecast VARCHAR(120),
  recruiter_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(220) NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id),
  related_candidate_id UUID REFERENCES candidates(id),
  related_job_id UUID REFERENCES jobs(id),
  related_client_id UUID REFERENCES clients(id),
  due_date DATE,
  priority priority_level NOT NULL DEFAULT 'Medium',
  status task_status NOT NULL DEFAULT 'Pending',
  category VARCHAR(120),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  visibility VARCHAR(40) NOT NULL DEFAULT 'Internal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CHECK (
    candidate_id IS NOT NULL OR
    job_id IS NOT NULL OR
    client_id IS NOT NULL OR
    submission_id IS NOT NULL
  )
);

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(120) NOT NULL,
  name VARCHAR(180) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES email_templates(id),
  candidate_id UUID REFERENCES candidates(id),
  job_id UUID REFERENCES jobs(id),
  client_id UUID REFERENCES clients(id),
  recipient_email VARCHAR(255) NOT NULL,
  cc_emails TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resume_attachment TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Draft',
  sent_at TIMESTAMPTZ,
  sender_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  doc_type VARCHAR(160) NOT NULL,
  status compliance_status NOT NULL DEFAULT 'Pending',
  file_url TEXT,
  uploaded_at TIMESTAMPTZ,
  expiry_date DATE,
  reviewer_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  action VARCHAR(120) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE candidate_call_logs (
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

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  actor_email VARCHAR(255),
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  action VARCHAR(120) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  body TEXT,
  notification_type VARCHAR(80),
  status notification_status NOT NULL DEFAULT 'Unread',
  related_entity_type VARCHAR(80),
  related_entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE bulk_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type VARCHAR(80) NOT NULL,
  file_name TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  imported_records INTEGER NOT NULL DEFAULT 0,
  warning_records INTEGER NOT NULL DEFAULT 0,
  warning_summary TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE autopilot_sourcing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  job_boards JSONB NOT NULL DEFAULT '[]'::jsonb,
  boolean_string TEXT,
  required_skills TEXT,
  preferred_skills TEXT,
  target_time_zone VARCHAR(20),
  profiles_per_day INTEGER CHECK (profiles_per_day BETWEEN 1 AND 50),
  status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  daily_email_to VARCHAR(255),
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(120) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Disconnected',
  connection_mode VARCHAR(80) NOT NULL DEFAULT 'Manual import',
  account_email VARCHAR(255),
  company_name VARCHAR(180),
  api_base_url TEXT,
  client_id VARCHAR(255),
  secret_reference TEXT,
  webhook_url TEXT,
  email_provider VARCHAR(120),
  imap_host VARCHAR(255),
  imap_port INTEGER,
  pop_host VARCHAR(255),
  pop_port INTEGER,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  mail_security VARCHAR(80),
  mailbox_folders TEXT,
  enabled_workflows JSONB NOT NULL DEFAULT '{}'::JSONB,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE integration_sync_logs (
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

CREATE TABLE onboarding_cases (
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

CREATE TABLE compliance_cases (
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

CREATE TABLE ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  feature VARCHAR(120) NOT NULL,
  prompt TEXT,
  response_summary TEXT,
  token_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_owner ON candidates(owner_id);
CREATE INDEX idx_candidates_search ON candidates USING GIN (to_tsvector('english', full_name || ' ' || COALESCE(current_title, '') || ' ' || COALESCE(skills_summary, '')));
CREATE INDEX idx_candidate_skills_candidate ON candidate_skills(candidate_id);
CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_status_priority ON jobs(status, priority);
CREATE INDEX idx_job_documents_job ON job_documents(job_id);
CREATE INDEX idx_job_skills_job ON job_skills(job_id);
CREATE INDEX idx_candidate_job_assignments_job ON candidate_job_assignments(job_id);
CREATE INDEX idx_resume_validations_candidate_job ON resume_validations(candidate_id, job_id);
CREATE INDEX idx_ai_match_scores_candidate_job ON ai_match_scores(candidate_id, job_id);
CREATE INDEX idx_submissions_candidate ON submissions(candidate_id);
CREATE INDEX idx_submissions_job ON submissions(job_id);
CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_placements_status ON placements(status);
CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_id, status);
CREATE INDEX idx_notes_candidate ON notes(candidate_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_candidate_call_logs_candidate ON candidate_call_logs(candidate_id, started_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_integration_sync_logs_provider ON integration_sync_logs(provider, created_at DESC);
CREATE INDEX idx_onboarding_cases_candidate ON onboarding_cases(candidate_id, status);
CREATE INDEX idx_compliance_cases_candidate ON compliance_cases(candidate_id, status, risk_level);
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_bulk_import_runs_type ON bulk_import_runs(import_type);
CREATE INDEX idx_autopilot_sourcing_runs_job ON autopilot_sourcing_runs(job_id);

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_candidate_skills_updated_at BEFORE UPDATE ON candidate_skills FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_candidate_documents_updated_at BEFORE UPDATE ON candidate_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_client_contacts_updated_at BEFORE UPDATE ON client_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_job_documents_updated_at BEFORE UPDATE ON job_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_job_skills_updated_at BEFORE UPDATE ON job_skills FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_candidate_job_assignments_updated_at BEFORE UPDATE ON candidate_job_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_resume_validations_updated_at BEFORE UPDATE ON resume_validations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ai_match_scores_updated_at BEFORE UPDATE ON ai_match_scores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_interviews_updated_at BEFORE UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_placements_updated_at BEFORE UPDATE ON placements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_email_logs_updated_at BEFORE UPDATE ON email_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_compliance_documents_updated_at BEFORE UPDATE ON compliance_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_activity_logs_updated_at BEFORE UPDATE ON activity_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_candidate_call_logs_updated_at BEFORE UPDATE ON candidate_call_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_audit_logs_updated_at BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bulk_import_runs_updated_at BEFORE UPDATE ON bulk_import_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_autopilot_sourcing_runs_updated_at BEFORE UPDATE ON autopilot_sourcing_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_onboarding_cases_updated_at BEFORE UPDATE ON onboarding_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_compliance_cases_updated_at BEFORE UPDATE ON compliance_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ai_logs_updated_at BEFORE UPDATE ON ai_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

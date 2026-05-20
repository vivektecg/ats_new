-- SQL Schema Starter for Bolt
-- Simple MySQL-compatible starter for The Eventus Consulting Group ATS.
-- Use this when Bolt asks for a plain SQL schema before wiring a backend.

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(50) DEFAULT 'Recruiter',
  phone VARCHAR(50),
  avatar_url TEXT,
  title VARCHAR(120),
  department VARCHAR(120),
  status VARCHAR(30) DEFAULT 'Active',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180),
  phone VARCHAR(50),
  current_title VARCHAR(180),
  current_company VARCHAR(180),
  location VARCHAR(180),
  skills_summary TEXT,
  total_experience VARCHAR(50),
  us_experience VARCHAR(50),
  work_authorization VARCHAR(80),
  visa_status VARCHAR(80),
  current_rate VARCHAR(50),
  expected_rate VARCHAR(50),
  availability VARCHAR(100),
  passport_number VARCHAR(120),
  resume_file TEXT,
  supporting_documents JSON,
  source VARCHAR(100),
  owner VARCHAR(100),
  status VARCHAR(50) DEFAULT 'New',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(180) NOT NULL,
  logo_url TEXT,
  client_type VARCHAR(80),
  website VARCHAR(180),
  industry VARCHAR(120),
  location VARCHAR(180),
  contact_name VARCHAR(180),
  contact_title VARCHAR(150),
  contact_email VARCHAR(180),
  contact_phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_job_id VARCHAR(120),
  job_title VARCHAR(180) NOT NULL,
  client_id INT,
  client_contact_name VARCHAR(180),
  spoc_name VARCHAR(180),
  location VARCHAR(180),
  work_mode VARCHAR(80),
  job_type VARCHAR(80),
  openings INT DEFAULT 1,
  pay_rate VARCHAR(80),
  bill_rate VARCHAR(80),
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Active',
  required_skills TEXT,
  preferred_skills TEXT,
  job_description TEXT,
  jd_attachment_name VARCHAR(255),
  jd_attachment_type VARCHAR(120),
  jd_attachment_size BIGINT,
  jd_attachment_url TEXT,
  submission_deadline DATE,
  tat_due_at DATE,
  tat_days INT,
  assigned_recruiter VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE job_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  document_type VARCHAR(120) DEFAULT 'JD',
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(120),
  file_size BIGINT,
  storage_url TEXT,
  source VARCHAR(80) DEFAULT 'ATS Upload',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  client_id INT NOT NULL,
  status VARCHAR(80) DEFAULT 'Submitted',
  submitted_rate VARCHAR(80),
  recruiter VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE interviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT,
  client_id INT,
  interview_type VARCHAR(80),
  interview_date DATE,
  interview_time VARCHAR(40),
  time_zone VARCHAR(40),
  duration VARCHAR(60),
  interviewer VARCHAR(180),
  status VARCHAR(50) DEFAULT 'Scheduled',
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  assignee VARCHAR(120),
  related_candidate_id INT,
  related_job_id INT,
  related_client_id INT,
  due_date DATE,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Pending',
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (related_candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (related_job_id) REFERENCES jobs(id),
  FOREIGN KEY (related_client_id) REFERENCES clients(id)
);

CREATE TABLE notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT,
  job_id INT,
  client_id INT,
  note_text TEXT NOT NULL,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE candidate_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  document_type VARCHAR(120),
  file_name VARCHAR(220),
  file_url TEXT,
  mime_type VARCHAR(120),
  file_size_bytes BIGINT,
  status VARCHAR(50) DEFAULT 'Uploaded',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id)
);

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT,
  action VARCHAR(120) NOT NULL,
  description TEXT,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE candidate_call_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  recruiter_id INT,
  phone VARCHAR(50) NOT NULL,
  outcome VARCHAR(80) DEFAULT 'Initiated',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  duration_seconds INT DEFAULT 0,
  provider VARCHAR(80) DEFAULT 'ATS Quick Call',
  provider_call_id VARCHAR(180),
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (recruiter_id) REFERENCES users(id)
);

-- Additional recommended ATS, CRM, AI, and audit tables.

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(80) UNIQUE NOT NULL,
  permissions_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_company VARCHAR(180) NOT NULL,
  vendor_contact VARCHAR(180),
  email VARCHAR(180),
  phone VARCHAR(50),
  client_represented VARCHAR(180),
  submission_format TEXT,
  rate_margin VARCHAR(80),
  payment_terms TEXT,
  agreement_status VARCHAR(50) DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE job_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  skill_name VARCHAR(150) NOT NULL,
  skill_type VARCHAR(50) DEFAULT 'Mandatory',
  years_required VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE candidate_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  skill_name VARCHAR(150) NOT NULL,
  years_experience VARCHAR(50),
  source VARCHAR(80) DEFAULT 'Resume',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id)
);

CREATE TABLE candidate_job_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  stage VARCHAR(80) DEFAULT 'Sourced',
  match_score DECIMAL(5,2),
  assigned_by VARCHAR(120),
  duplicate_warning TEXT,
  human_decision VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_candidate_job (candidate_id, job_id),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE resume_validations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  overall_match_percentage DECIMAL(5,2),
  mandatory_skills_match_percentage DECIMAL(5,2),
  preferred_skills_match_percentage DECIMAL(5,2),
  score_breakdown_json JSON,
  missing_mandatory_skills TEXT,
  missing_preferred_skills TEXT,
  weak_areas TEXT,
  red_flags TEXT,
  improvement_suggestions TEXT,
  recruiter_summary TEXT,
  client_submission_summary TEXT,
  screening_questions TEXT,
  final_recommendation VARCHAR(80),
  human_review_required BOOLEAN DEFAULT TRUE,
  ai_safety_notice TEXT DEFAULT 'AI can recommend, score, summarize, and flag gaps, but final decision must always be made by a human recruiter.',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE ai_match_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  score DECIMAL(5,2),
  score_formula_json JSON,
  explanation TEXT,
  missing_data TEXT,
  recommendation VARCHAR(80),
  human_review_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  client_id INT NOT NULL,
  submission_id INT,
  offer_status VARCHAR(80) DEFAULT 'Discussion',
  pay_rate VARCHAR(80),
  bill_rate VARCHAR(80),
  start_date DATE,
  offer_letter_version VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE TABLE placements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  client_id INT NOT NULL,
  offer_id INT,
  placement_status VARCHAR(80) DEFAULT 'Pending Start',
  start_date DATE,
  end_date DATE,
  revenue_amount DECIMAL(12,2),
  margin_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (offer_id) REFERENCES offers(id)
);

CREATE TABLE email_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_name VARCHAR(180) NOT NULL,
  category VARCHAR(120),
  subject VARCHAR(220),
  body TEXT,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE email_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT,
  job_id INT,
  client_id INT,
  template_id INT,
  email_to VARCHAR(180) NOT NULL,
  email_subject VARCHAR(220),
  email_body TEXT,
  resume_attachment TEXT,
  status VARCHAR(50) DEFAULT 'Draft',
  sent_by VARCHAR(120),
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (template_id) REFERENCES email_templates(id)
);

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor VARCHAR(180),
  entity_type VARCHAR(80),
  entity_id INT,
  action VARCHAR(120) NOT NULL,
  explanation TEXT,
  ai_module VARCHAR(120),
  jd_version VARCHAR(120),
  resume_version VARCHAR(120),
  score_breakdown_json JSON,
  human_final_decision VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(180) NOT NULL,
  message TEXT,
  notification_type VARCHAR(80),
  status VARCHAR(50) DEFAULT 'Unread',
  related_entity_type VARCHAR(80),
  related_entity_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE bulk_import_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  import_type VARCHAR(80) NOT NULL,
  file_name TEXT,
  total_records INT DEFAULT 0,
  imported_records INT DEFAULT 0,
  warning_records INT DEFAULT 0,
  warning_summary TEXT,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE autopilot_sourcing_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT,
  job_boards JSON,
  boolean_string TEXT,
  required_skills TEXT,
  preferred_skills TEXT,
  target_time_zone VARCHAR(20),
  profiles_per_day INT,
  status VARCHAR(50) DEFAULT 'Scheduled',
  daily_email_to VARCHAR(180),
  last_run_at TIMESTAMP NULL,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(120) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  status VARCHAR(40) DEFAULT 'Disconnected',
  connection_mode VARCHAR(80) DEFAULT 'Manual import',
  account_email VARCHAR(255),
  company_name VARCHAR(180),
  api_base_url TEXT,
  client_id VARCHAR(255),
  secret_reference TEXT,
  webhook_url TEXT,
  email_provider VARCHAR(120),
  imap_host VARCHAR(255),
  imap_port INT,
  pop_host VARCHAR(255),
  pop_port INT,
  smtp_host VARCHAR(255),
  smtp_port INT,
  mail_security VARCHAR(80),
  mailbox_folders TEXT,
  enabled_workflows JSON,
  config JSON,
  last_sync_at TIMESTAMP NULL,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE integration_sync_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  integration_id INT,
  provider VARCHAR(120) NOT NULL,
  status VARCHAR(80) DEFAULT 'Completed',
  records_synced INT DEFAULT 0,
  summary TEXT,
  metadata JSON,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (integration_id) REFERENCES integrations(id)
);

CREATE TABLE onboarding_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT,
  status VARCHAR(80) DEFAULT 'In Progress',
  start_date DATE,
  packet_sent_at TIMESTAMP NULL,
  e_signature_status VARCHAR(80) DEFAULT 'Not Sent',
  i9_status VARCHAR(80) DEFAULT 'Pending',
  everify_status VARCHAR(80) DEFAULT 'Pending',
  background_status VARCHAR(80) DEFAULT 'Pending',
  tasks JSON,
  activity JSON,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE compliance_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT,
  status VARCHAR(80) DEFAULT 'Pending',
  risk_level VARCHAR(40) DEFAULT 'Medium',
  checks JSON,
  activity JSON,
  created_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

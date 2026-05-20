-- Adds JD attachment storage metadata for job orders.
-- Store files in private server/object storage in production; keep metadata and storage paths in SQL.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS jd_attachment_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS jd_attachment_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS jd_attachment_size BIGINT,
  ADD COLUMN IF NOT EXISTS jd_attachment_url TEXT;

CREATE TABLE IF NOT EXISTS job_documents (
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

CREATE INDEX IF NOT EXISTS idx_job_documents_job ON job_documents(job_id);

DROP TRIGGER IF EXISTS trg_job_documents_updated_at ON job_documents;
CREATE TRIGGER trg_job_documents_updated_at
  BEFORE UPDATE ON job_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE job_documents IS 'JD and job-order attachments such as Outlook email, Word, PDF, image, text, or ZIP files.';
COMMENT ON COLUMN jobs.jd_attachment_url IS 'Private storage URL/path for the current JD attachment.';

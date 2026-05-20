-- Candidate document uploads store metadata/path in SQL.
-- Files should live in private server/object storage in production.

ALTER TABLE candidate_documents
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS file_url TEXT;

COMMENT ON COLUMN candidates.location IS 'Candidate current location.';
COMMENT ON COLUMN clients.location IS 'Client/customer office or headquarters location.';
COMMENT ON COLUMN jobs.location IS 'Manual job work location; do not auto-fill from client CRM office location.';
COMMENT ON COLUMN candidate_documents.file_url IS 'Private storage URL/path for uploaded resume, ID, DL, visa copy, and supporting documents.';

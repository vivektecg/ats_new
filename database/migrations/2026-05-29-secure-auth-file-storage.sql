CREATE INDEX IF NOT EXISTS idx_ats_file_uploads_candidate_id
  ON ats_records ((data->>'candidateId'))
  WHERE collection = 'fileUploads'
    AND data ? 'candidateId';

CREATE INDEX IF NOT EXISTS idx_ats_file_uploads_uploaded_at
  ON ats_records ((data->>'uploadedAt'))
  WHERE collection = 'fileUploads'
    AND data ? 'uploadedAt';


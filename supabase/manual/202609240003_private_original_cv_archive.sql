-- Prepared only. Do not execute as part of a GitHub-only promotion.
-- A private bucket is required before deploying the upload route that archives
-- the original PDF/DOCX/TXT before saving its extracted candidate data.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-original-cvs', 'candidate-original-cvs', false, 10485760,
  ARRAY['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain']
)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE bucket storage.buckets%ROWTYPE;
BEGIN
  SELECT * INTO bucket FROM storage.buckets WHERE id = 'candidate-original-cvs';
  IF NOT FOUND OR bucket.public IS DISTINCT FROM false
     OR bucket.file_size_limit IS DISTINCT FROM 10485760
     OR bucket.allowed_mime_types IS DISTINCT FROM ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain']::text[] THEN
    RAISE EXCEPTION 'Private original CV bucket configuration mismatch';
  END IF;
END $$;

-- Do not add anon/authenticated Storage policies. The server-only service
-- client performs all writes; object keys carry no name or contact details.
COMMIT;

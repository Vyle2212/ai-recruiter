-- Prepared for supervised cutover after a verified isolated restore.
-- This changes only the private original-CV bucket's per-file limit.
-- Confirm the project's global Storage limit is at least 20 MiB before running.
BEGIN;
DO $$
DECLARE bucket storage.buckets%ROWTYPE;
BEGIN
  SELECT * INTO bucket FROM storage.buckets
    WHERE id = 'candidate-original-cvs' FOR UPDATE;
  IF NOT FOUND OR bucket.public IS DISTINCT FROM false
     OR bucket.file_size_limit NOT IN (10485760, 20971520)
     OR bucket.allowed_mime_types IS DISTINCT FROM ARRAY[
       'application/pdf',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/msword',
       'application/rtf',
       'text/plain']::text[] THEN
    RAISE EXCEPTION 'Private original CV bucket configuration mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Review Storage object policies before original CV upload';
  END IF;
  UPDATE storage.buckets SET file_size_limit = 20971520
    WHERE id = 'candidate-original-cvs';
END $$;
COMMIT;

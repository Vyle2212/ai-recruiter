-- Read-only verification after the separately approved bucket creation.
BEGIN READ ONLY;
DO $$
DECLARE bucket storage.buckets%ROWTYPE;
BEGIN
  SELECT * INTO bucket FROM storage.buckets WHERE id = 'candidate-original-cvs';
  IF NOT FOUND OR bucket.public IS DISTINCT FROM false
     OR bucket.file_size_limit IS DISTINCT FROM 10485760
     OR bucket.allowed_mime_types IS DISTINCT FROM ARRAY[
       'application/pdf',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/msword',
       'application/rtf',
       'text/plain']::text[] THEN
    RAISE EXCEPTION 'Original CV private bucket not ready';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
  ) THEN
    -- Fail closed on any browser-role object policy, even if it does not
    -- mention this bucket: a broad policy could expose private originals.
    RAISE EXCEPTION 'Review Storage object policies before original CV upload';
  END IF;
END $$;
COMMIT;

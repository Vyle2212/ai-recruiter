-- No rows means the original CV bucket remains private and accepts 20 MiB.
select 'private_cv_bucket_configuration_mismatch' as finding
where not exists (
  select 1 from storage.buckets
  where id = 'candidate-original-cvs' and public = false
    and file_size_limit = 20971520
    and allowed_mime_types is not distinct from array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword', 'application/rtf', 'text/plain']::text[]
)
union all
select 'broad_storage_object_policy'
where exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and roles && array['public','anon','authenticated']::name[]
);

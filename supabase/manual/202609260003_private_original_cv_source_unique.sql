-- Narrow, reversible guard for archived original-CV references only.
-- Does not change candidate data, RLS, legacy source paths or Storage.
-- Check the target table and duplicate count before taking the brief DDL lock.
begin;

do $preflight$
begin
  if to_regclass('public.candidates') is null or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.candidates'::regclass
      and attname = 'source_file' and atttypid = 'text'::regtype
      and not attisdropped
  ) then
    raise exception 'private_cv_source_index_schema_missing';
  end if;
  if exists (
    select 1 from public.candidates
    where source_file like 'candidate-original-cvs/%'
    group by source_file having count(*) > 1
  ) then
    raise exception 'private_cv_source_index_duplicate_reference';
  end if;
end
$preflight$;

create unique index if not exists candidates_private_original_source_unique
  on public.candidates (source_file)
  where source_file like 'candidate-original-cvs/%';

commit;

-- Read-only verification. Run after 202609240007 and before enabling re-upload.
begin transaction read only;

do $readback$
declare
  missing_columns text[];
begin
  select array_agg(required.column_name order by required.column_name)
  into missing_columns
  from (
    values
      ('certifications'),
      ('projects'),
      ('extraction_coverage'),
      ('extraction_coverage_status'),
      ('profile_source_type')
  ) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'candidates'
      and c.column_name = required.column_name
  );

  if coalesce(array_length(missing_columns, 1), 0) > 0 then
    raise exception 'Candidate full-profile schema is incomplete: %', missing_columns;
  end if;

  if exists (
    select 1
    from public.candidates
    where extraction_coverage_status is not null
      and extraction_coverage_status not in (
        'complete_for_validation',
        'incomplete_needs_review'
      )
  ) then
    raise exception 'Unexpected candidate extraction coverage status exists';
  end if;
end
$readback$;

rollback;

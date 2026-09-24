-- Manual, reviewed schema step for the full-population CV re-upload.
-- This file prepares fields only. It does not ingest, overwrite, or backfill a CV.
begin;

alter table public.candidates
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists projects jsonb not null default '[]'::jsonb,
  add column if not exists extraction_coverage jsonb not null default '{}'::jsonb,
  add column if not exists extraction_coverage_status text,
  add column if not exists profile_source_type text;

do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidates_certifications_array_check'
      and conrelid = 'public.candidates'::regclass
  ) then
    alter table public.candidates
      add constraint candidates_certifications_array_check
      check (jsonb_typeof(certifications) = 'array') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidates_projects_array_check'
      and conrelid = 'public.candidates'::regclass
  ) then
    alter table public.candidates
      add constraint candidates_projects_array_check
      check (jsonb_typeof(projects) = 'array') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidates_extraction_coverage_status_check'
      and conrelid = 'public.candidates'::regclass
  ) then
    alter table public.candidates
      add constraint candidates_extraction_coverage_status_check
      check (
        extraction_coverage_status is null or
        extraction_coverage_status in (
          'complete_for_validation',
          'incomplete_needs_review'
        )
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidates_profile_source_type_check'
      and conrelid = 'public.candidates'::regclass
  ) then
    alter table public.candidates
      add constraint candidates_profile_source_type_check
      check (
        profile_source_type is null or
        profile_source_type in (
          'admin_upload',
          'candidate_upload',
          'candidate_confirmed',
          'recruiter_approved'
        )
      ) not valid;
  end if;
end
$guard$;

comment on column public.candidates.extraction_coverage is
  'PII-free field/section coverage metadata for the latest CV extraction.';
comment on column public.candidates.extraction_coverage_status is
  'Fail-closed search gate for source sections that were observed but not structured.';
comment on column public.candidates.profile_source_type is
  'Origin/trust tier of the current profile version.';

commit;

-- Acceptance-only prerequisite for candidate-owned CV and confirmation tests.
-- Mirrors the field/constraint additions in 202609240005 and 202609240007.
-- No claim function or production data is changed by this migration.
begin;

do $guard$ begin
  if not exists (
    select 1 from public.acceptance_environment_markers
    where singleton is true and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance' and acceptance_enabled is true
  ) then raise exception 'acceptance_marker_required'; end if;
  if (select count(*) from public.candidates) <> 0
     or (select count(*) from public.candidate_accounts) <> 0 then
    raise exception 'acceptance_candidate_fixture_population_not_empty';
  end if;
end $guard$;

alter table public.candidates
  add column if not exists profile_source_state jsonb not null default
    '{"origin":"admin_upload","field_sources":{}}'::jsonb,
  add column if not exists profile_confirmation_status text not null default 'not_claimed',
  add column if not exists candidate_confirmed_at timestamptz,
  add column if not exists claimed_by_candidate_at timestamptz,
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists projects jsonb not null default '[]'::jsonb,
  add column if not exists extraction_coverage jsonb not null default '{}'::jsonb,
  add column if not exists extraction_coverage_status text,
  add column if not exists profile_source_type text;

alter table public.candidates
  add constraint candidates_profile_confirmation_status_check
    check (profile_confirmation_status in (
      'not_claimed','claimed_incomplete','candidate_confirmed','recruiter_review_required'
    )),
  add constraint candidates_profile_source_state_object_check
    check (jsonb_typeof(profile_source_state) = 'object'),
  add constraint candidates_certifications_array_check
    check (jsonb_typeof(certifications) = 'array'),
  add constraint candidates_projects_array_check
    check (jsonb_typeof(projects) = 'array'),
  add constraint candidates_extraction_coverage_status_check
    check (extraction_coverage_status is null or extraction_coverage_status in (
      'complete_for_validation','incomplete_needs_review'
    )),
  add constraint candidates_profile_source_type_check
    check (profile_source_type is null or profile_source_type in (
      'admin_upload','candidate_upload','candidate_confirmed','recruiter_approved'
    ));

commit;

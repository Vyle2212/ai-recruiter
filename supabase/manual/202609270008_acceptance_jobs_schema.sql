-- Acceptance-only schema parity for synthetic job/share tests.
-- Applied to iujucosewivndjpcjbuz as migration 20260927133602.
-- This guard intentionally prevents applying the fixture schema elsewhere.
do $guard$ begin
  if not exists (
    select 1 from public.acceptance_environment_markers
    where singleton is true
      and project_ref = 'iujucosewivndjpcjbuz'
      and classification = 'acceptance'
      and acceptance_enabled is true
  ) then raise exception 'acceptance_marker_required'; end if;
  if to_regclass('public.jobs') is not null then
    raise exception 'jobs_already_exists';
  end if;
end $guard$;

+create table public.jobs (id uuid not null default gen_random_uuid(), title text, years integer default 0, skills text default '{}'::text[], requirements text[] default '{}'::text[], responsibilities text[] default '{}'::text[], raw_text text, created_at timestamp with time zone default now(), company text, location text, summary text, jd_text text, embedding vector(1536), status text, description text, updated_at timestamp with time zone default now(), parsed_data jsonb, sap_modules text[], years_required integer, level text, project_types text[], sap_submodules text[], requires_implementation boolean default false, requires_ams_support boolean default false, requires_rollout boolean default false, requires_migration boolean default false, language text, languages text[] default '{}'::text[], modules text[] default '{}'::text[], raw_jd text, primary_module text, secondary_modules text[] default '{}'::text[], required_module_authority integer default 0, required_primary_module text, required_secondary_modules text[] default '{}'::text[], required_module_authorities jsonb default '{}'::jsonb, requires_apac_delivery boolean default false, requires_regional_delivery boolean default false, requires_presales boolean default false, requires_workshop boolean default false, requires_blueprint boolean default false, requires_fit_gap boolean default false, requires_s4hana boolean default false, requires_transformation boolean default false, requires_consulting boolean default false, target_role_type text, target_consulting_level text, required_country_coverage integer default 0, required_regional_delivery_score integer default 0, constraint jobs_pkey primary key(id), constraint jobs_title_unique unique(title), constraint unique_job_title_company unique(title,company));

alter table public.jobs enable row level security;
alter table public.jobs force row level security;
revoke all on public.jobs from public, anon, authenticated;
grant select, insert, update, delete on public.jobs to service_role;
notify pgrst, 'reload schema';

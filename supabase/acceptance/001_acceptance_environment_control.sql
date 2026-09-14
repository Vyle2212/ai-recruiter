-- Production Trust Foundation authenticated acceptance control plane.
-- Apply manually to a confirmed disposable local/test/acceptance project only.
-- Required session settings:
--   set local app.acceptance_project_ref = '<non-production-project-ref>';
--   set local app.acceptance_environment_id = '<non-secret-environment-id>';
-- This script deliberately has no default project identity.

begin;

do $$
declare
  project_ref text := current_setting('app.acceptance_project_ref', true);
  environment_id text := current_setting('app.acceptance_environment_id', true);
begin
  if project_ref is null or project_ref !~ '^[a-z0-9][a-z0-9-]{5,62}$' then
    raise exception using errcode = 'P0001', message = 'acceptance_project_ref_required';
  end if;
  if environment_id is null or btrim(environment_id) = '' then
    raise exception using errcode = 'P0001', message = 'acceptance_environment_id_required';
  end if;
end $$;

create table if not exists public.acceptance_environment_markers (
  singleton boolean primary key default true check (singleton),
  project_ref text not null unique,
  environment_id text not null,
  classification text not null check (classification in ('local', 'test', 'acceptance')),
  acceptance_enabled boolean not null default false,
  harness_version text not null,
  reviewed_at timestamptz not null default now()
);

create table if not exists public.acceptance_test_runs (
  run_id text primary key,
  synthetic_namespace text not null unique,
  owner_hash text not null,
  expires_at timestamptz not null,
  status text not null check (status in ('provisioning', 'ready', 'running', 'cleaned', 'failed')),
  created_at timestamptz not null default now(),
  cleaned_at timestamptz,
  check (run_id like 'ptf1c2-%'),
  check (synthetic_namespace = 'ptf1c2/' || run_id),
  check (expires_at > created_at)
);

create table if not exists public.acceptance_test_entities (
  id uuid primary key default gen_random_uuid(),
  run_id text not null references public.acceptance_test_runs(run_id) on delete cascade,
  entity_type text not null check (entity_type in ('auth_user', 'user_profile', 'organization')),
  entity_id text not null,
  created_at timestamptz not null default now(),
  unique (run_id, entity_type, entity_id)
);

create table if not exists public.acceptance_synthetic_candidates (
  marker text primary key,
  candidate_id uuid not null unique,
  fixture_version text not null,
  synthetic_namespace text not null,
  owner_run_id text not null,
  owner_hash text not null,
  expected_commit_sha text not null check (expected_commit_sha ~ '^[a-f0-9]{40}$'),
  search_query text not null,
  active boolean not null default false,
  installed_at timestamptz not null default now(),
  check (synthetic_namespace like 'ptf1c2a/%'),
  check (marker like 'PTF Synthetic %')
);

alter table public.acceptance_environment_markers enable row level security;
alter table public.acceptance_test_runs enable row level security;
alter table public.acceptance_test_entities enable row level security;
alter table public.acceptance_synthetic_candidates enable row level security;
revoke all on public.acceptance_environment_markers from public, anon, authenticated;
revoke all on public.acceptance_test_runs from public, anon, authenticated;
revoke all on public.acceptance_test_entities from public, anon, authenticated;
revoke all on public.acceptance_synthetic_candidates from public, anon, authenticated;
grant all on public.acceptance_environment_markers to service_role;
grant all on public.acceptance_test_runs to service_role;
grant all on public.acceptance_test_entities to service_role;
grant all on public.acceptance_synthetic_candidates to service_role;

insert into public.acceptance_environment_markers (
  singleton,
  project_ref,
  environment_id,
  classification,
  acceptance_enabled,
  harness_version
) values (
  true,
  current_setting('app.acceptance_project_ref'),
  current_setting('app.acceptance_environment_id'),
  'acceptance',
  true,
  'production-trust-authenticated-acceptance-v1'
)
on conflict (singleton) do update set
  project_ref = excluded.project_ref,
  environment_id = excluded.environment_id,
  classification = excluded.classification,
  acceptance_enabled = excluded.acceptance_enabled,
  harness_version = excluded.harness_version,
  reviewed_at = now();

commit;

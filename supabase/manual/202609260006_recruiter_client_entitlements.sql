-- Reviewed-run schema preparation. No CV, job, subscription or user is created.
-- Candidate/job IDs are opaque until the domain tables exist in staging.
begin;

create table if not exists public.recruiter_original_cv_grants (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  recruiter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  approved_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  updated_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  purpose text not null check (purpose in ('headhunting', 'client_support')),
  client_id uuid,
  status text not null default 'active' check (status in ('active', 'revoked')),
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (candidate_id, recruiter_profile_id),
  check ((purpose = 'headhunting' and client_id is null)
     or (purpose = 'client_support' and client_id is not null)),
  check (expires_at > approved_at),
  check ((status = 'active' and revoked_at is null)
     or (status = 'revoked' and revoked_at is not null))
);
create index if not exists recruiter_original_cv_grants_recruiter_idx
  on public.recruiter_original_cv_grants (recruiter_profile_id, status, expires_at);

-- An append-only record is written by the same transaction as each grant change.
create table if not exists public.recruiter_original_cv_grant_events (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.recruiter_original_cv_grants(id) on delete restrict,
  candidate_id uuid not null,
  recruiter_profile_id uuid not null,
  actor_profile_id uuid not null,
  action text not null check (action in ('approved', 'revoked')),
  purpose text not null,
  client_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists recruiter_original_cv_grant_events_grant_idx
  on public.recruiter_original_cv_grant_events (grant_id, created_at desc);

create or replace function public.record_recruiter_original_cv_grant_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.recruiter_original_cv_grant_events
    (grant_id, candidate_id, recruiter_profile_id, actor_profile_id,
     action, purpose, client_id, expires_at)
  values
    (new.id, new.candidate_id, new.recruiter_profile_id,
     new.updated_by_profile_id,
     case when new.status = 'active' then 'approved' else 'revoked' end,
     new.purpose, new.client_id, new.expires_at);
  return new;
end;
$$;
revoke all on function public.record_recruiter_original_cv_grant_event() from public, anon, authenticated;
create trigger recruiter_original_cv_grant_event
after insert or update on public.recruiter_original_cv_grants
for each row execute function public.record_recruiter_original_cv_grant_event();

create or replace function public.reject_recruiter_original_cv_grant_event_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Original CV approval audit is append-only';
end;
$$;
revoke all on function public.reject_recruiter_original_cv_grant_event_change() from public, anon, authenticated;
create trigger recruiter_original_cv_grant_event_immutable
before update or delete on public.recruiter_original_cv_grant_events
for each row execute function public.reject_recruiter_original_cv_grant_event_change();

create table if not exists public.client_recruiter_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  recruiter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  assigned_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, recruiter_profile_id)
);
create index if not exists client_recruiter_assignments_recruiter_idx
  on public.client_recruiter_assignments (recruiter_profile_id, client_id)
  where status = 'active';

-- Authoritative ownership/visibility links must be issued by the trusted
-- ingestion or job workflow; the client sharing endpoint cannot create them.
create table if not exists public.client_candidate_access (
  client_id uuid not null,
  candidate_id uuid not null,
  status text not null check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  primary key (client_id, candidate_id)
);
create table if not exists public.client_job_ownership (
  client_id uuid not null,
  job_id uuid not null,
  status text not null check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  primary key (client_id, job_id)
);

create table if not exists public.client_feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  plan_code text not null check (length(plan_code) between 1 and 80),
  feature text not null check (feature in (
    'recruiter_support', 'unlimited_search', 'unlimited_job_posts',
    'candidate_chat', 'ats', 'candidate_comparison'
  )),
  quota_limit integer check (quota_limit is null or quota_limit >= 0),
  status text not null default 'active' check (status in ('active', 'revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  updated_at timestamptz not null default now(),
  unique (client_id, feature),
  check (valid_until is null or valid_until > valid_from)
);

create table if not exists public.client_candidate_shares (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  recruiter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  candidate_id uuid not null,
  shared_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, recruiter_profile_id, candidate_id)
);
create index if not exists client_candidate_shares_recruiter_idx
  on public.client_candidate_shares (recruiter_profile_id, candidate_id)
  where status = 'active';

create table if not exists public.client_job_shares (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  recruiter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  job_id uuid not null,
  shared_by_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, recruiter_profile_id, job_id)
);
create index if not exists client_job_shares_recruiter_idx
  on public.client_job_shares (recruiter_profile_id, job_id)
  where status = 'active';

alter table public.recruiter_original_cv_grants enable row level security;
alter table public.recruiter_original_cv_grants force row level security;
alter table public.recruiter_original_cv_grant_events enable row level security;
alter table public.recruiter_original_cv_grant_events force row level security;
alter table public.client_recruiter_assignments enable row level security;
alter table public.client_recruiter_assignments force row level security;
alter table public.client_candidate_access enable row level security;
alter table public.client_candidate_access force row level security;
alter table public.client_job_ownership enable row level security;
alter table public.client_job_ownership force row level security;
alter table public.client_feature_entitlements enable row level security;
alter table public.client_feature_entitlements force row level security;
alter table public.client_candidate_shares enable row level security;
alter table public.client_candidate_shares force row level security;
alter table public.client_job_shares enable row level security;
alter table public.client_job_shares force row level security;

revoke all on public.recruiter_original_cv_grants,
  public.recruiter_original_cv_grant_events,
  public.client_recruiter_assignments, public.client_candidate_access,
  public.client_job_ownership, public.client_feature_entitlements,
  public.client_candidate_shares, public.client_job_shares
  from public, anon, authenticated;
grant select, insert, update on public.recruiter_original_cv_grants,
  public.client_recruiter_assignments, public.client_candidate_access,
  public.client_job_ownership, public.client_feature_entitlements,
  public.client_candidate_shares, public.client_job_shares to service_role;
grant select, insert on public.recruiter_original_cv_grant_events to service_role;

commit;

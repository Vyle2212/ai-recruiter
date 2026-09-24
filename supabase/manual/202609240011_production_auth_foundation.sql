-- MANUAL, REVIEWED-RUN ONLY. DO NOT APPLY FROM CI.
-- Production Auth foundation v1. This is a one-shot schema/RLS artifact for
-- supervised execution only after a current restorable backup is verified.
-- It never creates an auth.users row, candidate row, client row or CV object.
begin;

do $preflight$
declare
  v_existing text[];
begin
  if to_regclass('auth.users') is null then
    raise exception 'production_auth_v1_auth_schema_missing';
  end if;
  if to_regclass('public.candidates') is null then
    raise exception 'production_auth_v1_candidates_missing';
  end if;

  select array_agg(object_name order by object_name) into v_existing
  from (values
    ('public.organizations', to_regclass('public.organizations')),
    ('public.user_profiles', to_regclass('public.user_profiles')),
    ('public.candidate_accounts', to_regclass('public.candidate_accounts')),
    ('private.production_auth_bootstrap_provenance', to_regclass('private.production_auth_bootstrap_provenance'))
  ) objects(object_name, object_oid)
  where object_oid is not null;

  if coalesce(cardinality(v_existing), 0) <> 0 then
    raise exception 'production_auth_v1_target_objects_already_exist';
  end if;
end
$preflight$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint production_organizations_name_not_blank check (btrim(name) <> ''),
  organization_type text not null constraint production_organizations_type_check
    check (organization_type in ('internal','client','partner')),
  status text not null default 'active' constraint production_organizations_status_check
    check (status in ('active','inactive','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  email text not null constraint production_user_profiles_email_not_blank check (btrim(email) <> ''),
  full_name text,
  role text not null constraint production_user_profiles_role_check
    check (role in ('admin','recruiter_manager','recruiter','client','candidate','guest')),
  status text not null default 'invited' constraint production_user_profiles_status_check
    check (status in ('invited','pending_claim','active','inactive','suspended','disabled')),
  organization_id uuid,
  client_id uuid,
  candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_user_profiles_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users(id) on delete restrict,
  constraint production_user_profiles_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) on delete restrict,
  constraint production_user_profiles_auth_user_id_key unique (auth_user_id),
  constraint production_user_profiles_role_ownership_shape_check check (
    (role = 'admin' and organization_id is not null and client_id is null and candidate_id is null) or
    (role in ('recruiter_manager','recruiter') and organization_id is not null and client_id is null and candidate_id is null) or
    (role = 'client' and organization_id is not null and client_id is not null and candidate_id is null) or
    (role = 'candidate' and organization_id is null and client_id is null and (
      (status = 'pending_claim' and candidate_id is null) or
      (status in ('active','inactive','suspended','disabled') and candidate_id is not null)
    )) or
    (role = 'guest' and organization_id is null and client_id is null and candidate_id is null and status <> 'active')
  )
);
comment on column public.user_profiles.candidate_id is
  'Null only while a verified candidate is pending_claim; active candidate access requires one safely claimed admin-uploaded profile.';

create table public.candidate_accounts (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  candidate_id uuid not null,
  status text not null default 'active' constraint production_candidate_accounts_status_check
    check (status in ('active','inactive','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_candidate_accounts_user_profile_id_fkey
    foreign key (user_profile_id) references public.user_profiles(id) on delete restrict,
  constraint production_candidate_accounts_user_profile_id_key unique (user_profile_id),
  constraint production_candidate_accounts_candidate_id_key unique (candidate_id)
);
comment on table public.candidate_accounts is
  'One-to-one ownership only. Admin uploads do not create candidate accounts.';

create table private.production_auth_bootstrap_provenance (
  id uuid primary key,
  bootstrap_reference text not null constraint production_auth_bootstrap_reference_not_blank check (btrim(bootstrap_reference) <> ''),
  project_ref text not null constraint production_auth_bootstrap_project_ref_not_blank check (btrim(project_ref) <> ''),
  organization_id uuid not null,
  admin_profile_id uuid not null,
  auth_user_id uuid not null,
  normalized_admin_email text not null constraint production_auth_bootstrap_email_not_blank check (btrim(normalized_admin_email) <> ''),
  bootstrap_type text not null constraint production_auth_bootstrap_type_check check (bootstrap_type = 'initial_owner'),
  created_at timestamptz not null default now(),
  constraint production_auth_bootstrap_reference_key unique (bootstrap_reference),
  constraint production_auth_bootstrap_project_ref_key unique (project_ref),
  constraint production_auth_bootstrap_organization_id_key unique (organization_id),
  constraint production_auth_bootstrap_admin_profile_id_key unique (admin_profile_id),
  constraint production_auth_bootstrap_auth_user_id_key unique (auth_user_id),
  constraint production_auth_bootstrap_type_key unique (bootstrap_type),
  constraint production_auth_bootstrap_organization_fkey
    foreign key (organization_id) references public.organizations(id) on delete restrict,
  constraint production_auth_bootstrap_admin_profile_fkey
    foreign key (admin_profile_id) references public.user_profiles(id) on delete restrict,
  constraint production_auth_bootstrap_auth_user_fkey
    foreign key (auth_user_id) references auth.users(id) on delete restrict
);
comment on table private.production_auth_bootstrap_provenance is
  'Immutable non-secret production initial-owner provenance. Never exposed through the Data API.';

create unique index production_user_profiles_email_normalized_uidx
  on public.user_profiles (lower(btrim(email)));
create index production_user_profiles_role_status_idx on public.user_profiles (role,status);
create index production_user_profiles_organization_id_idx on public.user_profiles (organization_id);
create index production_user_profiles_candidate_id_idx on public.user_profiles (candidate_id);
create index production_candidate_accounts_status_idx on public.candidate_accounts (status);

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;
alter table public.candidate_accounts enable row level security;
alter table public.candidate_accounts force row level security;

revoke all on table public.organizations, public.user_profiles, public.candidate_accounts
  from public, anon, authenticated;
revoke all on table private.production_auth_bootstrap_provenance
  from public, anon, authenticated;

grant select on table public.user_profiles to authenticated;
grant select, insert, update, delete on table
  public.organizations, public.user_profiles, public.candidate_accounts
  to service_role;
grant select, insert, update, delete on table private.production_auth_bootstrap_provenance
  to service_role;

create policy production_auth_v1_user_profiles_self_select
on public.user_profiles for select to authenticated
using ((select auth.uid()) = auth_user_id);

-- No anon policy. No browser INSERT/UPDATE/DELETE policy. Candidate ownership,
-- profile claims and admin mutations remain server-only and separately gated.
commit;

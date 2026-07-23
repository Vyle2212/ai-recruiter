-- STAGING AUTH FOUNDATION v1 � AUTHORITATIVE REVIEW ARTIFACT
-- REVIEW ONLY. NOT EXECUTED. STAGING TARGET ONLY. PRODUCTION BLOCKED.
-- Preconditions: dedicated empty/new staging project, reviewed backup, matching fingerprint, explicit manual approval.
-- CHECK constraints are used instead of enums so vocabulary changes and rollback remain explicit.
-- No role default exists. No users or roles are seeded. No candidate domain table is created or modified.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint organizations_name_not_blank check (btrim(name) <> ''),
  organization_type text not null constraint organizations_type_check check (organization_type in ('internal','client','candidate','partner')),
  status text not null default 'active' constraint organizations_status_check check (status in ('active','inactive','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organizations_organization_type_idx on public.organizations (organization_type);
create index if not exists organizations_status_idx on public.organizations (status);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  email text not null constraint user_profiles_email_not_blank check (btrim(email) <> ''),
  full_name text,
  role text not null constraint user_profiles_role_check check (role in ('admin','recruiter_manager','recruiter','client','candidate','guest')),
  status text not null default 'invited' constraint user_profiles_status_check check (status in ('invited','active','inactive','suspended','disabled')),
  organization_id uuid,
  client_id uuid,
  candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete restrict,
  constraint user_profiles_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict,
  constraint user_profiles_auth_user_id_key unique (auth_user_id)
);
comment on column public.user_profiles.client_id is 'Opaque staging UUID; canonical client foreign key is deferred.';
comment on column public.user_profiles.candidate_id is 'Opaque staging UUID; canonical candidate foreign key is deferred. No production mapping is automatic.';
create unique index if not exists user_profiles_auth_user_id_uidx on public.user_profiles (auth_user_id);
create unique index if not exists user_profiles_email_normalized_uidx on public.user_profiles (lower(btrim(email)));
create index if not exists user_profiles_role_idx on public.user_profiles (role);
create index if not exists user_profiles_status_idx on public.user_profiles (status);
create index if not exists user_profiles_organization_id_idx on public.user_profiles (organization_id);
create index if not exists user_profiles_client_id_idx on public.user_profiles (client_id);
create index if not exists user_profiles_candidate_id_idx on public.user_profiles (candidate_id);

create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null constraint user_invites_email_not_blank check (btrim(email) <> ''),
  invited_role text not null constraint user_invites_role_check check (invited_role in ('admin','recruiter_manager','recruiter','client','candidate','guest')),
  organization_id uuid,
  client_id uuid,
  candidate_id uuid,
  status text not null default 'pending' constraint user_invites_status_check check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_invites_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict
);
comment on table public.user_invites is 'Invitation token storage and email delivery are deferred; plaintext tokens are prohibited.';
comment on column public.user_invites.client_id is 'Opaque staging UUID; canonical client foreign key is deferred.';
comment on column public.user_invites.candidate_id is 'Opaque staging UUID; canonical candidate foreign key is deferred.';
create index if not exists user_invites_status_idx on public.user_invites (status);
create index if not exists user_invites_email_idx on public.user_invites (lower(btrim(email)));
create index if not exists user_invites_organization_id_idx on public.user_invites (organization_id);
create index if not exists user_invites_client_id_idx on public.user_invites (client_id);
create index if not exists user_invites_candidate_id_idx on public.user_invites (candidate_id);

create table if not exists public.client_memberships (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  organization_id uuid not null,
  client_id uuid not null,
  status text not null default 'active' constraint client_memberships_status_check check (status in ('active','inactive','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_memberships_user_profile_id_fkey foreign key (user_profile_id) references public.user_profiles(id) on delete restrict,
  constraint client_memberships_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict,
  constraint client_memberships_unique unique (user_profile_id, organization_id, client_id)
);
comment on column public.client_memberships.client_id is 'Opaque staging UUID; canonical client foreign key is deferred.';
create index if not exists client_memberships_user_profile_id_idx on public.client_memberships (user_profile_id);
create index if not exists client_memberships_organization_id_idx on public.client_memberships (organization_id);
create index if not exists client_memberships_client_id_idx on public.client_memberships (client_id);
create index if not exists client_memberships_status_idx on public.client_memberships (status);

create table if not exists public.candidate_accounts (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null,
  candidate_id uuid not null,
  status text not null default 'active' constraint candidate_accounts_status_check check (status in ('active','inactive','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_accounts_user_profile_id_fkey foreign key (user_profile_id) references public.user_profiles(id) on delete restrict,
  constraint candidate_accounts_user_profile_id_key unique (user_profile_id),
  constraint candidate_accounts_candidate_id_key unique (candidate_id)
);
comment on table public.candidate_accounts is 'Synthetic staging ownership mappings only; no production candidate copy or automatic assignment.';
comment on column public.candidate_accounts.candidate_id is 'Opaque staging UUID; canonical candidate foreign key is deferred.';
create index if not exists candidate_accounts_user_profile_id_idx on public.candidate_accounts (user_profile_id);
create index if not exists candidate_accounts_candidate_id_idx on public.candidate_accounts (candidate_id);
create index if not exists candidate_accounts_status_idx on public.candidate_accounts (status);

create table if not exists public.access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid,
  action text not null constraint access_audit_logs_action_not_blank check (btrim(action) <> ''),
  resource_type text not null constraint access_audit_logs_resource_type_not_blank check (btrim(resource_type) <> ''),
  resource_id text,
  result text not null constraint access_audit_logs_result_check check (result in ('allowed','denied','blocked','failed_safe')),
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint access_audit_logs_actor_profile_id_fkey foreign key (actor_profile_id) references public.user_profiles(id) on delete set null,
  constraint access_audit_logs_safe_metadata_object check (jsonb_typeof(safe_metadata) = 'object')
);
comment on table public.access_audit_logs is 'Append-only. Sensitive values, credentials, tokens, and raw environment values are prohibited.';
create index if not exists access_audit_logs_actor_profile_id_idx on public.access_audit_logs (actor_profile_id);
create index if not exists access_audit_logs_action_idx on public.access_audit_logs (action);
create index if not exists access_audit_logs_created_at_idx on public.access_audit_logs (created_at);
create index if not exists access_audit_logs_resource_lookup_idx on public.access_audit_logs (resource_type, resource_id);

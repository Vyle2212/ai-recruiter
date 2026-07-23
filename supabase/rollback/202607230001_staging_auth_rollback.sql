-- STAGING AUTH ROLLBACK v1 � AUTHORITATIVE REVIEW ARTIFACT
-- DANGEROUS AND DESTRUCTIVE. REVIEW ONLY. NOT EXECUTED.
-- STAGING ONLY. REQUIRE CONFIRMED BACKUP, MATCHING FINGERPRINT, AND EXPLICIT MANUAL APPROVAL.
-- Never target production. This file does not touch domain candidates, jobs, submissions, packs, or reports.

-- 1. Policies first.
drop policy if exists candidate_candidate_accounts_select on public.candidate_accounts;
drop policy if exists candidate_user_profiles_update on public.user_profiles;
drop policy if exists candidate_user_profiles_select on public.user_profiles;
drop policy if exists client_client_memberships_select on public.client_memberships;
drop policy if exists client_user_profiles_update on public.user_profiles;
drop policy if exists client_user_profiles_select on public.user_profiles;
drop policy if exists client_organizations_select on public.organizations;
drop policy if exists recruiter_user_profiles_update on public.user_profiles;
drop policy if exists recruiter_user_profiles_select on public.user_profiles;
drop policy if exists recruiter_organizations_select on public.organizations;
drop policy if exists recruiter_manager_user_profiles_select on public.user_profiles;
drop policy if exists recruiter_manager_organizations_select on public.organizations;
drop policy if exists admin_access_audit_logs_select on public.access_audit_logs;
drop policy if exists admin_candidate_accounts_update on public.candidate_accounts;
drop policy if exists admin_candidate_accounts_insert on public.candidate_accounts;
drop policy if exists admin_candidate_accounts_select on public.candidate_accounts;
drop policy if exists admin_client_memberships_update on public.client_memberships;
drop policy if exists admin_client_memberships_insert on public.client_memberships;
drop policy if exists admin_client_memberships_select on public.client_memberships;
drop policy if exists admin_user_invites_update on public.user_invites;
drop policy if exists admin_user_invites_insert on public.user_invites;
drop policy if exists admin_user_invites_select on public.user_invites;
drop policy if exists admin_user_profiles_update on public.user_profiles;
drop policy if exists admin_user_profiles_insert on public.user_profiles;
drop policy if exists admin_user_profiles_select on public.user_profiles;
drop policy if exists admin_organizations_update on public.organizations;
drop policy if exists admin_organizations_insert on public.organizations;
drop policy if exists admin_organizations_select on public.organizations;

-- 2. Triggers before their functions.
drop trigger if exists candidate_accounts_set_updated_at on public.candidate_accounts;
drop trigger if exists client_memberships_set_updated_at on public.client_memberships;
drop trigger if exists user_invites_set_updated_at on public.user_invites;
drop trigger if exists user_profiles_guard_protected on public.user_profiles;
drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
drop trigger if exists organizations_set_updated_at on public.organizations;

-- 3. Disable the RLS additions before table removal.
alter table if exists public.access_audit_logs disable row level security;
alter table if exists public.candidate_accounts disable row level security;
alter table if exists public.client_memberships disable row level security;
alter table if exists public.user_invites disable row level security;
alter table if exists public.user_profiles disable row level security;
alter table if exists public.organizations disable row level security;

-- 4. Helper and guard functions after policies/triggers.
drop function if exists public.guard_user_profile_protected_columns();
drop function if exists public.current_user_is_admin();
drop function if exists public.current_user_candidate_id();
drop function if exists public.current_user_client_id();
drop function if exists public.current_user_organization_id();
drop function if exists public.current_user_role();
drop function if exists public.current_user_profile_id();
drop function if exists public.set_staging_auth_updated_at();

-- 5. Auth-foundation tables in reverse dependency order only.
drop table if exists public.access_audit_logs;
drop table if exists public.candidate_accounts;
drop table if exists public.client_memberships;
drop table if exists public.user_invites;
drop table if exists public.user_profiles;
drop table if exists public.organizations;

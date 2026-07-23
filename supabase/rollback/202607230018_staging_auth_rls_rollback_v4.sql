-- STAGING AUTH RLS ROLLBACK v4 - REVIEW ONLY - NOT EXECUTED
-- STAGING ONLY. Run first in reverse order. Backup and explicit human approval required. PRODUCTION BLOCKED.
begin;
do $$ begin if to_regclass('public.staging_auth_bootstrap_provenance') is not null then
  execute 'revoke all on public.staging_auth_bootstrap_provenance from anon';
  execute 'revoke all on public.staging_auth_bootstrap_provenance from authenticated';
  execute 'drop policy if exists staging_auth_v4_admin_bootstrap_provenance_select on public.staging_auth_bootstrap_provenance';
  execute 'alter table public.staging_auth_bootstrap_provenance disable row level security';
end if; end $$;
do $$ begin if to_regclass('public.access_audit_logs') is not null then
  execute 'revoke all on public.access_audit_logs from anon'; execute 'revoke all on public.access_audit_logs from authenticated';
  execute 'drop policy if exists staging_auth_v4_admin_access_audit_logs_select on public.access_audit_logs';
  execute 'alter table public.access_audit_logs disable row level security';
end if; end $$;
do $$ begin if to_regclass('public.candidate_accounts') is not null then
  execute 'revoke all on public.candidate_accounts from anon'; execute 'revoke all on public.candidate_accounts from authenticated';
  execute 'drop policy if exists staging_auth_v4_candidate_candidate_accounts_select on public.candidate_accounts';
  execute 'drop policy if exists staging_auth_v4_admin_candidate_accounts_update on public.candidate_accounts';
  execute 'drop policy if exists staging_auth_v4_admin_candidate_accounts_insert on public.candidate_accounts';
  execute 'drop policy if exists staging_auth_v4_admin_candidate_accounts_select on public.candidate_accounts';
  execute 'alter table public.candidate_accounts disable row level security';
end if; end $$;
do $$ begin if to_regclass('public.client_memberships') is not null then
  execute 'revoke all on public.client_memberships from anon'; execute 'revoke all on public.client_memberships from authenticated';
  execute 'drop policy if exists staging_auth_v4_client_client_memberships_select on public.client_memberships';
  execute 'drop policy if exists staging_auth_v4_admin_client_memberships_update on public.client_memberships';
  execute 'drop policy if exists staging_auth_v4_admin_client_memberships_insert on public.client_memberships';
  execute 'drop policy if exists staging_auth_v4_admin_client_memberships_select on public.client_memberships';
  execute 'alter table public.client_memberships disable row level security';
end if; end $$;
do $$ begin if to_regclass('public.user_invites') is not null then
  execute 'revoke all on public.user_invites from anon'; execute 'revoke all on public.user_invites from authenticated';
  execute 'drop policy if exists staging_auth_v4_admin_user_invites_update on public.user_invites';
  execute 'drop policy if exists staging_auth_v4_admin_user_invites_insert on public.user_invites';
  execute 'drop policy if exists staging_auth_v4_admin_user_invites_select on public.user_invites';
  execute 'alter table public.user_invites disable row level security';
end if; end $$;
do $$ begin if to_regclass('public.user_profiles') is not null then
  execute 'revoke all on public.user_profiles from anon'; execute 'revoke all on public.user_profiles from authenticated';
  execute 'drop policy if exists staging_auth_v4_candidate_user_profiles_update on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_candidate_user_profiles_select on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_client_user_profiles_update on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_client_user_profiles_select on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_recruiter_user_profiles_update on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_recruiter_user_profiles_select on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_recruiter_manager_user_profiles_self_update on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_recruiter_manager_user_profiles_self_select on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_admin_user_profiles_update on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_admin_user_profiles_insert on public.user_profiles';
  execute 'drop policy if exists staging_auth_v4_admin_user_profiles_select on public.user_profiles';
  execute 'alter table public.user_profiles disable row level security';
end if; end $$;
do $$ begin if to_regclass('public.organizations') is not null then
  execute 'revoke all on public.organizations from anon'; execute 'revoke all on public.organizations from authenticated';
  execute 'drop policy if exists staging_auth_v4_client_organizations_select on public.organizations';
  execute 'drop policy if exists staging_auth_v4_recruiter_organizations_select on public.organizations';
  execute 'drop policy if exists staging_auth_v4_recruiter_manager_organizations_select on public.organizations';
  execute 'drop policy if exists staging_auth_v4_admin_organizations_update on public.organizations';
  execute 'drop policy if exists staging_auth_v4_admin_organizations_insert on public.organizations';
  execute 'drop policy if exists staging_auth_v4_admin_organizations_select on public.organizations';
  execute 'alter table public.organizations disable row level security';
end if; end $$;
commit;
-- No table, Auth user, candidate-domain object, or production object is dropped or modified.

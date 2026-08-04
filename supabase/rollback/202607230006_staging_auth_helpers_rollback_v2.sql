-- STAGING AUTH HELPERS ROLLBACK v2 - REVIEW ONLY - NOT EXECUTED
-- VERSIONED, PHASE-SPECIFIC, STAGING-ONLY. Run only after the RLS rollback when RLS was started.
-- BACKUP AND EXPLICIT MANUAL APPROVAL REQUIRED. Guarded for partial helper application.
begin;

do $$ begin if to_regclass('public.access_audit_logs') is not null then
  execute 'drop trigger if exists access_audit_logs_reject_delete on public.access_audit_logs';
  execute 'drop trigger if exists access_audit_logs_reject_update on public.access_audit_logs';
end if; end $$;
do $$ begin if to_regclass('public.candidate_accounts') is not null then execute 'drop trigger if exists candidate_accounts_set_updated_at on public.candidate_accounts'; end if; end $$;
do $$ begin if to_regclass('public.client_memberships') is not null then execute 'drop trigger if exists client_memberships_set_updated_at on public.client_memberships'; end if; end $$;
do $$ begin if to_regclass('public.user_invites') is not null then execute 'drop trigger if exists user_invites_set_updated_at on public.user_invites'; end if; end $$;
do $$ begin if to_regclass('public.user_profiles') is not null then
  execute 'drop trigger if exists user_profiles_guard_protected on public.user_profiles';
  execute 'drop trigger if exists user_profiles_set_updated_at on public.user_profiles';
end if; end $$;
do $$ begin if to_regclass('public.organizations') is not null then execute 'drop trigger if exists organizations_set_updated_at on public.organizations'; end if; end $$;

drop function if exists public.reject_access_audit_log_mutation();
drop function if exists public.guard_user_profile_protected_columns();
drop function if exists public.current_user_is_admin();
drop function if exists public.current_user_candidate_id();
drop function if exists public.current_user_client_id();
drop function if exists public.current_user_organization_id();
drop function if exists public.current_user_role();
drop function if exists public.current_user_profile_id();
drop function if exists public.set_staging_auth_updated_at();

commit;
-- No tables or production/domain objects are dropped.
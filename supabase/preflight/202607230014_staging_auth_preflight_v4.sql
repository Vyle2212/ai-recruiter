-- STAGING AUTH PREFLIGHT v4 - REVIEW ONLY - NOT EXECUTED
-- VERSIONED, ONE-SHOT, STAGING-ONLY. MANUAL EXECUTION ONLY. PRODUCTION BLOCKED.
-- Catalog and privilege inspection only. No Auth rows, application rows, candidate-domain objects, or production objects are read.

begin;
set transaction read only;

do $preflight$
declare
  conflicting_object text;
begin
  if current_user <> 'postgres' then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_execution_role_must_be_postgres';
  end if;
  if to_regnamespace('public') is null or to_regnamespace('auth') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_required_schema_missing';
  end if;
  if to_regclass('auth.users') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_auth_users_missing';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pgcrypto') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_pgcrypto_missing';
  end if;
  if to_regprocedure('gen_random_uuid()') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_uuid_support_missing';
  end if;
  if not exists (select 1 from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_plpgsql_missing';
  end if;
  if to_regprocedure('auth.uid()') is null or not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_type t on t.oid = p.prorettype
    where n.nspname = 'auth' and p.proname = 'uid' and p.pronargs = 0 and t.typname = 'uuid'
  ) then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_auth_uid_signature_missing';
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'postgres' and rolbypassrls) then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_postgres_missing_or_not_bypassrls';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_anon_role_missing';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_authenticated_role_missing';
  end if;
  if not has_schema_privilege(current_user, 'public', 'USAGE') or not has_schema_privilege(current_user, 'public', 'CREATE') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_public_schema_privilege_missing';
  end if;
  if not has_schema_privilege(current_user, 'auth', 'USAGE') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_auth_schema_usage_missing';
  end if;
  if not has_table_privilege(current_user, 'auth.users', 'SELECT') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_auth_users_select_missing';
  end if;
  if not has_schema_privilege('authenticated', 'public', 'USAGE') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_authenticated_public_usage_missing';
  end if;

  select c.relname into conflicting_object
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any (array[
    'organizations','user_profiles','user_invites','client_memberships','candidate_accounts',
    'access_audit_logs','staging_auth_bootstrap_provenance'
  ]) limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_table_or_relation_conflict';
  end if;

  select p.proname into conflicting_object
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.pronargs = 0 and p.proname = any (array[
    'set_staging_auth_updated_at','current_user_profile_id','current_user_role',
    'current_user_organization_id','current_user_client_id','current_user_candidate_id',
    'current_user_is_admin','guard_user_profile_protected_columns','reject_access_audit_log_mutation'
  ]) limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_exact_function_conflict';
  end if;

  select t.tgname into conflicting_object
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname = 'public' and (
    (c.relname = 'organizations' and t.tgname = 'organizations_set_updated_at') or
    (c.relname = 'user_profiles' and t.tgname in ('user_profiles_set_updated_at','user_profiles_guard_protected')) or
    (c.relname = 'user_invites' and t.tgname = 'user_invites_set_updated_at') or
    (c.relname = 'client_memberships' and t.tgname = 'client_memberships_set_updated_at') or
    (c.relname = 'candidate_accounts' and t.tgname = 'candidate_accounts_set_updated_at') or
    (c.relname = 'access_audit_logs' and t.tgname in ('access_audit_logs_reject_update','access_audit_logs_reject_delete'))
  ) limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_scoped_trigger_conflict';
  end if;

  select pol.polname into conflicting_object
  from pg_catalog.pg_policy pol
  join pg_catalog.pg_class c on c.oid = pol.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and (
    (c.relname = 'organizations' and pol.polname in (
      'staging_auth_v4_admin_organizations_select','staging_auth_v4_admin_organizations_insert','staging_auth_v4_admin_organizations_update',
      'staging_auth_v4_recruiter_manager_organizations_select','staging_auth_v4_recruiter_organizations_select','staging_auth_v4_client_organizations_select'
    )) or
    (c.relname = 'user_profiles' and pol.polname in (
      'staging_auth_v4_admin_user_profiles_select','staging_auth_v4_admin_user_profiles_insert','staging_auth_v4_admin_user_profiles_update',
      'staging_auth_v4_recruiter_manager_user_profiles_self_select','staging_auth_v4_recruiter_manager_user_profiles_self_update',
      'staging_auth_v4_recruiter_user_profiles_select','staging_auth_v4_recruiter_user_profiles_update',
      'staging_auth_v4_client_user_profiles_select','staging_auth_v4_client_user_profiles_update',
      'staging_auth_v4_candidate_user_profiles_select','staging_auth_v4_candidate_user_profiles_update'
    )) or
    (c.relname = 'user_invites' and pol.polname in ('staging_auth_v4_admin_user_invites_select','staging_auth_v4_admin_user_invites_insert','staging_auth_v4_admin_user_invites_update')) or
    (c.relname = 'client_memberships' and pol.polname in ('staging_auth_v4_admin_client_memberships_select','staging_auth_v4_admin_client_memberships_insert','staging_auth_v4_admin_client_memberships_update','staging_auth_v4_client_client_memberships_select')) or
    (c.relname = 'candidate_accounts' and pol.polname in ('staging_auth_v4_admin_candidate_accounts_select','staging_auth_v4_admin_candidate_accounts_insert','staging_auth_v4_admin_candidate_accounts_update','staging_auth_v4_candidate_candidate_accounts_select')) or
    (c.relname = 'access_audit_logs' and pol.polname = 'staging_auth_v4_admin_access_audit_logs_select') or
    (c.relname = 'staging_auth_bootstrap_provenance' and pol.polname = 'staging_auth_v4_admin_bootstrap_provenance_select')
  ) limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v4_scoped_policy_conflict';
  end if;
end;
$preflight$;

rollback;
-- Expected result: all catalog checks pass and the read-only transaction rolls back without changes.

-- STAGING AUTH PREFLIGHT v3 - REVIEW ONLY - NOT EXECUTED
-- VERSIONED, ONE-SHOT, STAGING-ONLY. MANUAL EXECUTION ONLY. PRODUCTION BLOCKED.
-- Human checklist: confirm the staging target, production is not selected, backup exists, and fingerprint is approved.
-- Catalog and privilege inspection only. No application rows, candidate-domain objects, or production objects are read.

begin;
set transaction read only;

do $preflight$
declare
  conflicting_object text;
begin
  if current_user <> 'postgres' then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_execution_role_must_be_postgres';
  end if;

  if to_regnamespace('public') is null or to_regnamespace('auth') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_required_schema_missing';
  end if;
  if to_regclass('auth.users') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_auth_users_missing';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pgcrypto') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_pgcrypto_missing';
  end if;
  if to_regprocedure('gen_random_uuid()') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_uuid_support_missing';
  end if;
  if not exists (select 1 from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_plpgsql_missing';
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'postgres' and rolbypassrls) then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_postgres_missing_or_not_bypassrls';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_anon_role_missing';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_authenticated_role_missing';
  end if;

  if not has_schema_privilege(current_user, 'public', 'USAGE') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_public_usage_missing';
  end if;
  if not has_schema_privilege(current_user, 'public', 'CREATE') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_public_create_missing';
  end if;
  if not has_schema_privilege(current_user, 'auth', 'USAGE') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_auth_usage_missing';
  end if;
  if not has_table_privilege(current_user, 'auth.users', 'SELECT') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_auth_users_metadata_privilege_missing';
  end if;
  if not has_schema_privilege('authenticated', 'public', 'USAGE') then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_authenticated_public_usage_missing';
  end if;

  -- current_user is postgres. Objects and functions are therefore created under the reviewed postgres owner.
  -- The owner may REVOKE PUBLIC and GRANT only intended helper EXECUTE privileges to authenticated.
  select c.relname into conflicting_object
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any (array[
      'organizations','user_profiles','user_invites','client_memberships','candidate_accounts','access_audit_logs'
    ])
  limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_table_or_relation_conflict';
  end if;

  select p.proname into conflicting_object
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any (array[
      'set_staging_auth_updated_at','current_user_profile_id','current_user_role',
      'current_user_organization_id','current_user_client_id','current_user_candidate_id',
      'current_user_is_admin','guard_user_profile_protected_columns','reject_access_audit_log_mutation'
    ])
  limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_function_conflict';
  end if;

  select t.tgname into conflicting_object
  from pg_catalog.pg_trigger t
  where not t.tgisinternal
    and t.tgname = any (array[
      'organizations_set_updated_at','user_profiles_set_updated_at','user_profiles_guard_protected',
      'user_invites_set_updated_at','client_memberships_set_updated_at','candidate_accounts_set_updated_at',
      'access_audit_logs_reject_update','access_audit_logs_reject_delete'
    ])
  limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_trigger_conflict';
  end if;

  select pol.polname into conflicting_object
  from pg_catalog.pg_policy pol
  where pol.polname like 'staging_auth_v3_%'
  limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_v3_policy_conflict';
  end if;
end;
$preflight$;

rollback;
-- Expected result: all catalog and privilege assertions pass, then the read-only transaction rolls back.

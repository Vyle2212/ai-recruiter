-- STAGING AUTH PREFLIGHT v2 - REVIEW ONLY - NOT EXECUTED
-- VERSIONED, ONE-SHOT, STAGING-ONLY. PRODUCTION BLOCKED.
-- MANUAL CHECKLIST: confirm staging target, confirm production is not selected, confirm backup, review fingerprint.
-- This artifact reads PostgreSQL catalog metadata only. It does not alter, create, drop, or read application data.

begin transaction read only;

do $$
declare
  conflicting_object text;
begin
  if to_regnamespace('public') is null or to_regnamespace('auth') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_required_schema_missing';
  end if;
  if to_regclass('auth.users') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_auth_users_missing';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pgcrypto') then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_pgcrypto_missing';
  end if;
  if to_regprocedure('gen_random_uuid()') is null then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_uuid_support_missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'postgres' and rolbypassrls
  ) then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_reviewed_function_owner_missing_or_not_bypassrls';
  end if;

  select c.relname into conflicting_object
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any (array[
    'organizations','user_profiles','user_invites','client_memberships','candidate_accounts','access_audit_logs'
  ]) limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_table_or_relation_conflict';
  end if;

  select p.proname into conflicting_object
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = any (array[
    'set_staging_auth_updated_at','current_user_profile_id','current_user_role',
    'current_user_organization_id','current_user_client_id','current_user_candidate_id',
    'current_user_is_admin','guard_user_profile_protected_columns','reject_access_audit_log_mutation'
  ]) limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_function_conflict';
  end if;

  select t.tgname into conflicting_object
  from pg_catalog.pg_trigger t
  where not t.tgisinternal and t.tgname = any (array[
    'organizations_set_updated_at','user_profiles_set_updated_at','user_profiles_guard_protected',
    'user_invites_set_updated_at','client_memberships_set_updated_at','candidate_accounts_set_updated_at',
    'access_audit_logs_reject_update','access_audit_logs_reject_delete'
  ]) limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_trigger_conflict';
  end if;

  select pol.polname into conflicting_object
  from pg_catalog.pg_policy pol
  where pol.polname like 'staging_auth_v2_%' limit 1;
  if conflicting_object is not null then
    raise exception using errcode = 'P0001', message = 'staging_auth_preflight_policy_conflict';
  end if;
end;
$$;

rollback;
-- Expected outcome: catalog checks pass and the read-only transaction rolls back without changes.
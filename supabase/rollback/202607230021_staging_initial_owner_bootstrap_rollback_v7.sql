-- STAGING INITIAL OWNER BOOTSTRAP ROLLBACK v7 - REVIEW ONLY - NOT EXECUTED
-- STAGING ONLY. DESTRUCTIVE. Backup and explicit human approval required. PRODUCTION BLOCKED.
-- V7 uses one substitution-safe JSON configuration token and exact provenance checks.

begin;
do $rollback$
declare
  config_json_text constant text := '__STAGING_BOOTSTRAP_CONFIG_JSON__';
  v_config jsonb;
  v_required_keys constant text[] := array[
    'provenance_id','organization_id','organization_name','auth_user_id',
    'admin_profile_id','admin_email','bootstrap_reference'
  ];
  v_key text;
  v_provenance_id uuid;
  v_organization_id uuid;
  v_organization_name text;
  v_auth_user_id uuid;
  v_admin_profile_id uuid;
  v_admin_email text;
  v_bootstrap_reference text;
  affected_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(731942607230017);

  if config_json_text = concat('__STAGING_BOOTSTRAP_', 'CONFIG_JSON__') then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_config_not_replaced';
  end if;
  begin
    v_config := config_json_text::jsonb;
  exception when others then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_config_malformed';
  end;
  if jsonb_typeof(v_config) <> 'object' then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_config_not_object';
  end if;
  if (select count(*) from jsonb_object_keys(v_config)) <> cardinality(v_required_keys)
    or exists (
      select 1 from jsonb_object_keys(v_config) supplied(key)
      where not (supplied.key = any(v_required_keys))
    )
    or exists (
      select 1 from unnest(v_required_keys) required(key)
      where not (v_config ? required.key)
    ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_config_fields_invalid';
  end if;
  foreach v_key in array v_required_keys loop
    if jsonb_typeof(v_config -> v_key) <> 'string'
      or btrim(v_config ->> v_key) = '' then
      raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_config_value_invalid';
    end if;
  end loop;

  v_organization_name := btrim(v_config ->> 'organization_name');
  v_admin_email := lower(btrim(v_config ->> 'admin_email'));
  v_bootstrap_reference := btrim(v_config ->> 'bootstrap_reference');
  begin
    v_provenance_id := (v_config ->> 'provenance_id')::uuid;
    v_organization_id := (v_config ->> 'organization_id')::uuid;
    v_auth_user_id := (v_config ->> 'auth_user_id')::uuid;
    v_admin_profile_id := (v_config ->> 'admin_profile_id')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_config_uuid_invalid';
  end;

  perform 1 from public.staging_auth_bootstrap_provenance p
  where p.id = v_provenance_id
    and p.bootstrap_reference = v_bootstrap_reference
    and p.organization_id = v_organization_id
    and p.admin_profile_id = v_admin_profile_id
    and p.auth_user_id = v_auth_user_id
    and p.normalized_admin_email = v_admin_email
    and p.bootstrap_type = 'initial_owner'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_provenance_mismatch';
  end if;

  perform 1 from public.user_profiles p
  where p.id = v_admin_profile_id
    and p.auth_user_id = v_auth_user_id
    and lower(btrim(p.email)) = v_admin_email
    and p.role = 'admin'
    and p.status = 'active'
    and p.organization_id = v_organization_id
    and p.client_id is null
    and p.candidate_id is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_profile_mismatch';
  end if;

  perform 1 from auth.users u
  where u.id = v_auth_user_id
    and lower(btrim(u.email)) = v_admin_email
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_auth_identity_mismatch';
  end if;

  perform 1 from public.organizations o
  where o.id = v_organization_id
    and btrim(o.name) = v_organization_name
    and o.organization_type = 'internal'
    and o.status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_organization_mismatch';
  end if;

  if exists (
    select 1 from public.client_memberships m
    where m.user_profile_id = v_admin_profile_id or m.organization_id = v_organization_id
  ) or exists (
    select 1 from public.candidate_accounts c where c.user_profile_id = v_admin_profile_id
  ) or exists (
    select 1 from public.access_audit_logs a where a.actor_profile_id = v_admin_profile_id
  ) or exists (
    select 1 from public.user_invites i where i.organization_id = v_organization_id
  ) or exists (
    select 1 from public.user_profiles p
    where p.organization_id = v_organization_id and p.id <> v_admin_profile_id
  ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_dependent_record_exists';
  end if;

  delete from public.staging_auth_bootstrap_provenance p
  where p.id = v_provenance_id and p.bootstrap_reference = v_bootstrap_reference;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_provenance_delete_count_invalid';
  end if;

  delete from public.user_profiles p
  where p.id = v_admin_profile_id and p.auth_user_id = v_auth_user_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_profile_delete_count_invalid';
  end if;

  delete from public.organizations o
  where o.id = v_organization_id and btrim(o.name) = v_organization_name;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_rollback_organization_delete_count_invalid';
  end if;
end;
$rollback$;
commit;
-- Raw configuration JSON is never persisted. auth.users, candidate-domain data,
-- and production objects are never deleted or modified.

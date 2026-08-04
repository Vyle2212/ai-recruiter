-- STAGING INITIAL OWNER BOOTSTRAP v7 - TEMPLATE ONLY - NOT EXECUTED
-- STAGING ONLY. MANUAL EXECUTION ONLY. NEVER RUN ON PRODUCTION. Backup and explicit approval required.
-- V7 replaces V5's substitution/sentinel collision with one JSON configuration token.
-- It creates one organization, one admin profile, and one immutable provenance row; it never creates an Auth user.

begin;
do $bootstrap$
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
  v_confirmed_auth_email text;
  affected_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(731942607230017);

  -- The sentinel is assembled from immutable fragments, so replacing the single
  -- configuration token cannot rewrite this guard into a tautology.
  if config_json_text = concat('__STAGING_BOOTSTRAP_', 'CONFIG_JSON__') then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_config_not_replaced';
  end if;

  begin
    v_config := config_json_text::jsonb;
  exception when others then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_config_malformed';
  end;

  if jsonb_typeof(v_config) <> 'object' then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_config_not_object';
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
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_config_fields_invalid';
  end if;

  foreach v_key in array v_required_keys loop
    if jsonb_typeof(v_config -> v_key) <> 'string'
      or btrim(v_config ->> v_key) = '' then
      raise exception using errcode = 'P0001', message = 'staging_owner_v7_config_value_invalid';
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
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_config_uuid_invalid';
  end;

  select lower(btrim(u.email)) into v_confirmed_auth_email
  from auth.users u where u.id = v_auth_user_id for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_auth_identity_not_confirmed';
  end if;
  if v_confirmed_auth_email is null or v_confirmed_auth_email <> v_admin_email then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_auth_email_mismatch';
  end if;
  if exists (
    select 1 from public.staging_auth_bootstrap_provenance p
    where p.bootstrap_type = 'initial_owner'
  ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_provenance_already_exists';
  end if;
  if exists (
    select 1 from public.user_profiles p where p.role = 'admin' and p.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_active_admin_already_exists';
  end if;
  if exists (
    select 1 from public.user_profiles p where p.auth_user_id = v_auth_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_auth_profile_already_exists';
  end if;
  if exists (
    select 1 from public.organizations o where o.id = v_organization_id
  ) or exists (
    select 1 from public.organizations o
    where lower(btrim(o.name)) = lower(v_organization_name)
  ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_organization_conflict';
  end if;
  if exists (
    select 1 from public.user_profiles p where p.id = v_admin_profile_id
  ) or exists (
    select 1 from public.user_profiles p where lower(btrim(p.email)) = v_admin_email
  ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_profile_conflict';
  end if;
  if exists (
    select 1 from public.staging_auth_bootstrap_provenance p
    where p.id = v_provenance_id or p.bootstrap_reference = v_bootstrap_reference
  ) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_provenance_conflict';
  end if;

  insert into public.organizations(id,name,organization_type,status)
  values(v_organization_id,v_organization_name,'internal','active');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_organization_insert_count_invalid';
  end if;

  insert into public.user_profiles(
    id,auth_user_id,email,full_name,role,status,organization_id,client_id,candidate_id
  ) values (
    v_admin_profile_id,v_auth_user_id,v_admin_email,null,'admin','active',
    v_organization_id,null,null
  );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_profile_insert_count_invalid';
  end if;

  insert into public.staging_auth_bootstrap_provenance(
    id,bootstrap_reference,organization_id,admin_profile_id,auth_user_id,
    normalized_admin_email,bootstrap_type
  ) values (
    v_provenance_id,v_bootstrap_reference,v_organization_id,v_admin_profile_id,
    v_auth_user_id,v_admin_email,'initial_owner'
  );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_v7_provenance_insert_count_invalid';
  end if;
end;
$bootstrap$;
commit;
-- Raw configuration JSON is never persisted. No session, cookie, email,
-- candidate-domain record, or production object is created or modified.

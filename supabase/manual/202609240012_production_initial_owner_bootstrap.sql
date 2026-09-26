-- MANUAL, REVIEWED-RUN ONLY. DO NOT APPLY FROM CI.
-- Run only after 202609240011 and after an operator confirms the exact project,
-- current restorable backup and a pre-existing verified Supabase Auth identity.
-- This artifact never creates, updates or deletes auth.users.
begin;

do $bootstrap$
declare
  config_b64_text constant text := '__PRODUCTION_BOOTSTRAP_CONFIG_B64__';
  v_config jsonb;
  v_required_keys constant text[] := array[
    'provenance_id','project_ref','organization_id','organization_name',
    'auth_user_id','admin_profile_id','admin_email','bootstrap_reference'
  ];
  v_key text;
  v_provenance_id uuid;
  v_project_ref text;
  v_organization_id uuid;
  v_organization_name text;
  v_auth_user_id uuid;
  v_admin_profile_id uuid;
  v_admin_email text;
  v_bootstrap_reference text;
  v_verified_email text;
  affected_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(731942609240012);

  if config_b64_text = concat('__PRODUCTION_BOOTSTRAP_', 'CONFIG_B64__') then
    raise exception 'production_owner_v1_config_not_replaced';
  end if;
  begin
    v_config := pg_catalog.convert_from(
      pg_catalog.decode(config_b64_text, 'base64'), 'UTF8'
    )::jsonb;
  exception
    when others then
      raise exception 'production_owner_v1_config_invalid';
  end;

  if jsonb_typeof(v_config) <> 'object'
     or (select count(*) from jsonb_object_keys(v_config)) <> cardinality(v_required_keys)
     or exists (
       select 1 from jsonb_object_keys(v_config) supplied(key)
       where not (supplied.key = any(v_required_keys))
     )
     or exists (
       select 1 from unnest(v_required_keys) required(key)
       where not (v_config ? required.key)
     ) then
    raise exception 'production_owner_v1_config_fields_invalid';
  end if;

  foreach v_key in array v_required_keys loop
    if jsonb_typeof(v_config -> v_key) <> 'string'
       or btrim(v_config ->> v_key) = '' then
      raise exception 'production_owner_v1_config_value_invalid';
    end if;
  end loop;

  begin
    v_provenance_id := (v_config ->> 'provenance_id')::uuid;
    v_organization_id := (v_config ->> 'organization_id')::uuid;
    v_auth_user_id := (v_config ->> 'auth_user_id')::uuid;
    v_admin_profile_id := (v_config ->> 'admin_profile_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'production_owner_v1_config_uuid_invalid';
  end;
  v_project_ref := btrim(v_config ->> 'project_ref');
  v_organization_name := btrim(v_config ->> 'organization_name');
  v_admin_email := lower(btrim(v_config ->> 'admin_email'));
  v_bootstrap_reference := btrim(v_config ->> 'bootstrap_reference');

  if to_regclass('private.production_auth_bootstrap_provenance') is null
     or to_regclass('public.organizations') is null
     or to_regclass('public.user_profiles') is null then
    raise exception 'production_owner_v1_foundation_missing';
  end if;

  select lower(btrim(u.email)) into v_verified_email
  from auth.users u
  where u.id = v_auth_user_id and u.email_confirmed_at is not null
  for share;
  if v_verified_email is null then
    raise exception 'production_owner_v1_verified_auth_identity_missing';
  end if;
  if v_verified_email <> v_admin_email then
    raise exception 'production_owner_v1_auth_email_mismatch';
  end if;
  if exists (select 1 from private.production_auth_bootstrap_provenance)
     or exists (select 1 from public.user_profiles where role = 'admin' and status = 'active') then
    raise exception 'production_owner_v1_already_bootstrapped';
  end if;
  if exists (
    select 1 from public.user_profiles
    where auth_user_id = v_auth_user_id or lower(btrim(email)) = v_admin_email
  ) then
    raise exception 'production_owner_v1_profile_conflict';
  end if;
  if exists (
    select 1 from public.organizations
    where id = v_organization_id or lower(btrim(name)) = lower(v_organization_name)
  ) then
    raise exception 'production_owner_v1_organization_conflict';
  end if;

  insert into public.organizations(id,name,organization_type,status)
  values(v_organization_id,v_organization_name,'internal','active');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'production_owner_v1_organization_insert_invalid'; end if;

  insert into public.user_profiles(
    id,auth_user_id,email,full_name,role,status,organization_id,client_id,candidate_id
  ) values (
    v_admin_profile_id,v_auth_user_id,v_admin_email,null,'admin','active',
    v_organization_id,null,null
  );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'production_owner_v1_profile_insert_invalid'; end if;

  insert into private.production_auth_bootstrap_provenance(
    id,bootstrap_reference,project_ref,organization_id,admin_profile_id,
    auth_user_id,normalized_admin_email,bootstrap_type
  ) values (
    v_provenance_id,v_bootstrap_reference,v_project_ref,v_organization_id,
    v_admin_profile_id,v_auth_user_id,v_admin_email,'initial_owner'
  );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'production_owner_v1_provenance_insert_invalid'; end if;
end
$bootstrap$;

commit;

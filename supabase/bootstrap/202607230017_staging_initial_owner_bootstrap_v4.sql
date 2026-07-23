-- STAGING INITIAL OWNER BOOTSTRAP v4 - TEMPLATE ONLY - NOT EXECUTED
-- STAGING ONLY. MANUAL EXECUTION ONLY. NEVER RUN ON PRODUCTION. Backup and explicit approval required.
-- Creates one organization, one admin profile, and one immutable provenance row; never creates an Auth user.

begin;
do $bootstrap$
declare
  provenance_id_text constant text := '__STAGING_BOOTSTRAP_PROVENANCE_ID__';
  organization_id_text constant text := '__STAGING_ORGANIZATION_ID__';
  organization_name constant text := '__STAGING_ORGANIZATION_NAME__';
  auth_user_id_text constant text := '__STAGING_AUTH_USER_ID__';
  admin_profile_id_text constant text := '__STAGING_ADMIN_PROFILE_ID__';
  admin_email constant text := lower(btrim('__STAGING_ADMIN_EMAIL__'));
  bootstrap_reference constant text := '__STAGING_BOOTSTRAP_REFERENCE__';
  v_provenance_id uuid; v_organization_id uuid; v_auth_user_id uuid; v_admin_profile_id uuid;
  confirmed_auth_email text; affected_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(731942607230017);

  if provenance_id_text = '__STAGING_BOOTSTRAP_PROVENANCE_ID__'
    or organization_id_text = '__STAGING_ORGANIZATION_ID__'
    or organization_name = '__STAGING_ORGANIZATION_NAME__'
    or auth_user_id_text = '__STAGING_AUTH_USER_ID__'
    or admin_profile_id_text = '__STAGING_ADMIN_PROFILE_ID__'
    or admin_email = lower('__STAGING_ADMIN_EMAIL__')
    or bootstrap_reference = '__STAGING_BOOTSTRAP_REFERENCE__' then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_placeholder_not_replaced';
  end if;
  if btrim(organization_name) = '' or admin_email = '' or btrim(bootstrap_reference) = '' then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_required_value_missing';
  end if;
  begin
    v_provenance_id := provenance_id_text::uuid; v_organization_id := organization_id_text::uuid;
    v_auth_user_id := auth_user_id_text::uuid; v_admin_profile_id := admin_profile_id_text::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_uuid_invalid';
  end;

  select lower(btrim(u.email)) into confirmed_auth_email
  from auth.users u where u.id = v_auth_user_id for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_auth_identity_not_confirmed';
  end if;
  if confirmed_auth_email is null or confirmed_auth_email <> admin_email then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_auth_email_mismatch';
  end if;
  if exists (select 1 from public.staging_auth_bootstrap_provenance where bootstrap_type = 'initial_owner') then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_provenance_already_exists';
  end if;
  if exists (select 1 from public.user_profiles where role = 'admin' and status = 'active') then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_active_admin_already_exists';
  end if;
  if exists (select 1 from public.user_profiles p where p.auth_user_id = v_auth_user_id) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_auth_profile_already_exists';
  end if;
  if exists (select 1 from public.organizations o where o.id = v_organization_id) or exists (
    select 1 from public.organizations where lower(btrim(name)) = lower(btrim(organization_name))
  ) then raise exception using errcode = 'P0001', message = 'staging_owner_v4_organization_conflict'; end if;
  if exists (select 1 from public.user_profiles p where p.id = v_admin_profile_id) or exists (
    select 1 from public.user_profiles where lower(btrim(email)) = admin_email
  ) then raise exception using errcode = 'P0001', message = 'staging_owner_v4_profile_conflict'; end if;
  if exists (select 1 from public.staging_auth_bootstrap_provenance p where p.id = v_provenance_id or p.bootstrap_reference = btrim(bootstrap_reference)) then
    raise exception using errcode = 'P0001', message = 'staging_owner_v4_provenance_conflict';
  end if;

  insert into public.organizations(id,name,organization_type,status)
  values(v_organization_id,btrim(organization_name),'internal','active');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception using errcode='P0001',message='staging_owner_v4_organization_insert_count_invalid'; end if;

  insert into public.user_profiles(id,auth_user_id,email,full_name,role,status,organization_id,client_id,candidate_id)
  values(v_admin_profile_id,v_auth_user_id,admin_email,null,'admin','active',v_organization_id,null,null);
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception using errcode='P0001',message='staging_owner_v4_profile_insert_count_invalid'; end if;

  insert into public.staging_auth_bootstrap_provenance(
    id,bootstrap_reference,organization_id,admin_profile_id,auth_user_id,normalized_admin_email,bootstrap_type
  ) values (
    v_provenance_id,btrim(bootstrap_reference),v_organization_id,v_admin_profile_id,v_auth_user_id,admin_email,'initial_owner'
  );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception using errcode='P0001',message='staging_owner_v4_provenance_insert_count_invalid'; end if;
end;
$bootstrap$;
commit;
-- No session, cookie, email, candidate-domain record, or production object is created or modified.

-- STAGING INITIAL OWNER BOOTSTRAP v3 - TEMPLATE ONLY - NOT EXECUTED
-- STAGING ONLY. NEVER RUN ON PRODUCTION. Backup, fingerprint review, and explicit owner approval required.
-- A staging Auth user must be created manually and its identity confirmed before this template is considered.
-- Immutable provenance is the exact organization ID, profile ID, Auth user ID, normalized email, and safe reference below.

begin;

do $bootstrap$
declare
  bootstrap_organization_id_text constant text := '__STAGING_ORGANIZATION_ID__';
  bootstrap_organization_name constant text := '__STAGING_ORGANIZATION_NAME__';
  bootstrap_auth_user_id_text constant text := '__STAGING_AUTH_USER_ID__';
  bootstrap_admin_profile_id_text constant text := '__STAGING_ADMIN_PROFILE_ID__';
  bootstrap_admin_email constant text := lower(btrim('__STAGING_ADMIN_EMAIL__'));
  bootstrap_reference constant text := '__STAGING_BOOTSTRAP_REFERENCE__';
  bootstrap_organization_id uuid;
  bootstrap_auth_user_id uuid;
  bootstrap_admin_profile_id uuid;
  affected_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(731942607230012);

  if bootstrap_organization_id_text like '__STAGING_%__'
    or bootstrap_organization_name like '__STAGING_%__'
    or bootstrap_auth_user_id_text like '__STAGING_%__'
    or bootstrap_admin_profile_id_text like '__STAGING_%__'
    or bootstrap_admin_email like '__staging_%__'
    or bootstrap_reference like '__STAGING_%__' then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_placeholder_not_replaced';
  end if;
  if btrim(bootstrap_organization_name) = '' or bootstrap_admin_email = '' or bootstrap_reference = '' then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_required_value_missing';
  end if;

  begin
    bootstrap_organization_id := bootstrap_organization_id_text::uuid;
    bootstrap_auth_user_id := bootstrap_auth_user_id_text::uuid;
    bootstrap_admin_profile_id := bootstrap_admin_profile_id_text::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_uuid_invalid';
  end;

  if exists (select 1 from public.user_profiles where role = 'admin' and status = 'active') then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_active_admin_already_exists';
  end if;
  if not exists (select 1 from auth.users where id = bootstrap_auth_user_id) then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_auth_identity_not_confirmed';
  end if;
  if exists (select 1 from public.user_profiles where auth_user_id = bootstrap_auth_user_id) then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_auth_profile_already_exists';
  end if;
  if exists (select 1 from public.organizations where id = bootstrap_organization_id) then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_organization_id_conflict';
  end if;
  if exists (select 1 from public.organizations where lower(btrim(name)) = lower(btrim(bootstrap_organization_name))) then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_organization_name_conflict';
  end if;
  if exists (select 1 from public.user_profiles where id = bootstrap_admin_profile_id) then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_profile_id_conflict';
  end if;
  if exists (select 1 from public.user_profiles where lower(btrim(email)) = bootstrap_admin_email) then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_email_conflict';
  end if;

  insert into public.organizations (id, name, organization_type, status)
  values (bootstrap_organization_id, btrim(bootstrap_organization_name), 'internal', 'active');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_organization_insert_count_invalid';
  end if;

  insert into public.user_profiles (
    id, auth_user_id, email, full_name, role, status, organization_id, client_id, candidate_id
  ) values (
    bootstrap_admin_profile_id, bootstrap_auth_user_id, bootstrap_admin_email, null,
    'admin', 'active', bootstrap_organization_id, null, null
  );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_bootstrap_profile_insert_count_invalid';
  end if;

  -- Safe external evidence reference only: bootstrap_reference. It contains no credential or secret.
  perform bootstrap_reference;
end;
$bootstrap$;

commit;
-- Creates no Auth user, session, cookie, email, candidate mapping, domain record, or production object.

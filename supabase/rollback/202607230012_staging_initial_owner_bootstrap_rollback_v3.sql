-- STAGING INITIAL OWNER BOOTSTRAP ROLLBACK v3 - REVIEW ONLY - NOT EXECUTED
-- STAGING ONLY. DESTRUCTIVE. Backup and explicit human approval required. PRODUCTION BLOCKED.
-- Exact IDs are immutable bootstrap provenance; Auth users and candidate-domain data are untouched.

begin;

do $rollback$
declare
  bootstrap_organization_id_text constant text := '__STAGING_ORGANIZATION_ID__';
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
    or bootstrap_auth_user_id_text like '__STAGING_%__'
    or bootstrap_admin_profile_id_text like '__STAGING_%__'
    or bootstrap_admin_email like '__staging_%__'
    or bootstrap_reference like '__STAGING_%__' then
    raise exception using errcode = 'P0001', message = 'staging_owner_rollback_placeholder_not_replaced';
  end if;
  begin
    bootstrap_organization_id := bootstrap_organization_id_text::uuid;
    bootstrap_auth_user_id := bootstrap_auth_user_id_text::uuid;
    bootstrap_admin_profile_id := bootstrap_admin_profile_id_text::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'staging_owner_rollback_uuid_invalid';
  end;

  perform 1 from public.user_profiles
  where id = bootstrap_admin_profile_id
    and auth_user_id = bootstrap_auth_user_id
    and lower(btrim(email)) = bootstrap_admin_email
    and role = 'admin' and status = 'active'
    and organization_id = bootstrap_organization_id
    and client_id is null and candidate_id is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'staging_owner_rollback_profile_provenance_mismatch';
  end if;
  if exists (select 1 from public.client_memberships where user_profile_id = bootstrap_admin_profile_id)
    or exists (select 1 from public.candidate_accounts where user_profile_id = bootstrap_admin_profile_id)
    or exists (select 1 from public.access_audit_logs where actor_profile_id = bootstrap_admin_profile_id)
    or exists (select 1 from public.user_invites where organization_id = bootstrap_organization_id)
    or exists (select 1 from public.client_memberships where organization_id = bootstrap_organization_id)
    or exists (select 1 from public.user_profiles where organization_id = bootstrap_organization_id and id <> bootstrap_admin_profile_id) then
    raise exception using errcode = 'P0001', message = 'staging_owner_rollback_dependent_record_exists';
  end if;

  delete from public.user_profiles
  where id = bootstrap_admin_profile_id
    and auth_user_id = bootstrap_auth_user_id
    and lower(btrim(email)) = bootstrap_admin_email
    and role = 'admin' and status = 'active'
    and organization_id = bootstrap_organization_id
    and client_id is null and candidate_id is null;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_rollback_profile_delete_count_invalid';
  end if;

  delete from public.organizations
  where id = bootstrap_organization_id and organization_type = 'internal' and status = 'active';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'staging_owner_rollback_organization_delete_count_invalid';
  end if;
  perform bootstrap_reference;
end;
$rollback$;

commit;
-- The manually created staging Auth user is deliberately retained and must be governed separately.

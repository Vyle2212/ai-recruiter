-- STAGING INITIAL OWNER BOOTSTRAP ROLLBACK v5 - REVIEW ONLY - NOT EXECUTED
-- STAGING ONLY. DESTRUCTIVE. Backup and explicit human approval required. PRODUCTION BLOCKED.
-- V5 fixes the rejected V4 bootstrap-reference ambiguity and retains exact provenance checks.
begin;
do $rollback$
declare
  provenance_id_text constant text := '__STAGING_BOOTSTRAP_PROVENANCE_ID__';
  organization_id_text constant text := '__STAGING_ORGANIZATION_ID__';
  organization_name constant text := '__STAGING_ORGANIZATION_NAME__';
  auth_user_id_text constant text := '__STAGING_AUTH_USER_ID__';
  admin_profile_id_text constant text := '__STAGING_ADMIN_PROFILE_ID__';
  admin_email constant text := lower(btrim('__STAGING_ADMIN_EMAIL__'));
  v_bootstrap_reference constant text := btrim('__STAGING_BOOTSTRAP_REFERENCE__');
  v_provenance_id uuid; v_organization_id uuid; v_auth_user_id uuid; v_admin_profile_id uuid;
  affected_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(731942607230017);
  if provenance_id_text='__STAGING_BOOTSTRAP_PROVENANCE_ID__'
    or organization_id_text='__STAGING_ORGANIZATION_ID__'
    or organization_name='__STAGING_ORGANIZATION_NAME__'
    or auth_user_id_text='__STAGING_AUTH_USER_ID__'
    or admin_profile_id_text='__STAGING_ADMIN_PROFILE_ID__'
    or admin_email=lower('__STAGING_ADMIN_EMAIL__')
    or v_bootstrap_reference='__STAGING_BOOTSTRAP_REFERENCE__' then
    raise exception using errcode='P0001',message='staging_owner_v5_rollback_placeholder_not_replaced';
  end if;
  if btrim(organization_name) = '' or admin_email = '' or v_bootstrap_reference = '' then
    raise exception using errcode='P0001',message='staging_owner_v5_rollback_required_value_missing';
  end if;
  begin
    v_provenance_id:=provenance_id_text::uuid; v_organization_id:=organization_id_text::uuid;
    v_auth_user_id:=auth_user_id_text::uuid; v_admin_profile_id:=admin_profile_id_text::uuid;
  exception when invalid_text_representation then
    raise exception using errcode='P0001',message='staging_owner_v5_rollback_uuid_invalid';
  end;

  perform 1 from public.staging_auth_bootstrap_provenance p
  where p.id=v_provenance_id and p.bootstrap_reference=v_bootstrap_reference
    and p.organization_id=v_organization_id and p.admin_profile_id=v_admin_profile_id
    and p.auth_user_id=v_auth_user_id and p.normalized_admin_email=admin_email
    and p.bootstrap_type='initial_owner' for update;
  if not found then raise exception using errcode='P0001',message='staging_owner_v5_rollback_provenance_mismatch'; end if;

  perform 1 from public.user_profiles p
  where p.id=v_admin_profile_id and p.auth_user_id=v_auth_user_id and lower(btrim(p.email))=admin_email
    and p.role='admin' and p.status='active' and p.organization_id=v_organization_id
    and p.client_id is null and p.candidate_id is null for update;
  if not found then raise exception using errcode='P0001',message='staging_owner_v5_rollback_profile_mismatch'; end if;

  perform 1 from public.organizations o
  where o.id=v_organization_id and btrim(o.name)=btrim(organization_name)
    and o.organization_type='internal' and o.status='active' for update;
  if not found then raise exception using errcode='P0001',message='staging_owner_v5_rollback_organization_mismatch'; end if;

  if exists(select 1 from public.client_memberships m where m.user_profile_id=v_admin_profile_id or m.organization_id=v_organization_id)
    or exists(select 1 from public.candidate_accounts c where c.user_profile_id=v_admin_profile_id)
    or exists(select 1 from public.access_audit_logs a where a.actor_profile_id=v_admin_profile_id)
    or exists(select 1 from public.user_invites i where i.organization_id=v_organization_id)
    or exists(select 1 from public.user_profiles p where p.organization_id=v_organization_id and p.id<>v_admin_profile_id) then
    raise exception using errcode='P0001',message='staging_owner_v5_rollback_dependent_record_exists';
  end if;

  delete from public.staging_auth_bootstrap_provenance p
  where p.id=v_provenance_id and p.bootstrap_reference=v_bootstrap_reference;
  get diagnostics affected_rows=row_count;
  if affected_rows<>1 then raise exception using errcode='P0001',message='staging_owner_v5_rollback_provenance_delete_count_invalid'; end if;
  delete from public.user_profiles p where p.id=v_admin_profile_id and p.auth_user_id=v_auth_user_id;
  get diagnostics affected_rows=row_count;
  if affected_rows<>1 then raise exception using errcode='P0001',message='staging_owner_v5_rollback_profile_delete_count_invalid'; end if;
  delete from public.organizations o where o.id=v_organization_id and btrim(o.name)=btrim(organization_name);
  get diagnostics affected_rows=row_count;
  if affected_rows<>1 then raise exception using errcode='P0001',message='staging_owner_v5_rollback_organization_delete_count_invalid'; end if;
end;
$rollback$;
commit;
-- Auth users, other admins, domain candidates, jobs, submissions, packs, reports, and production objects are untouched.

-- STAGING ONLY - MANUAL SECURITY HARDENING - DO NOT APPLY TO PRODUCTION.
-- Move RLS-only identity helpers out of the exposed public API schema.
-- This patch is intentionally one-shot and fails closed unless the observed
-- staging policy surface is still exactly the reviewed 31-policy set.

begin;

select pg_advisory_xact_lock(731942609270000);

do $preflight$
declare
  v_public_helpers integer;
  v_helper_policies integer;
begin
  if current_user <> 'postgres' then
    raise exception using errcode = '42501', message = 'staging_private_helpers_requires_postgres';
  end if;

  if to_regclass('public.user_profiles') is null then
    raise exception using errcode = '42P01', message = 'staging_private_helpers_profile_table_missing';
  end if;

  if to_regnamespace('private') is not null then
    raise exception using errcode = '42P06', message = 'staging_private_helpers_schema_already_exists';
  end if;

  select count(*) into v_public_helpers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any (array[
      'current_user_profile_id',
      'current_user_role',
      'current_user_organization_id',
      'current_user_client_id',
      'current_user_candidate_id',
      'current_user_is_admin'
    ])
    and p.pronargs = 0;

  if v_public_helpers <> 6 then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_public_contract_changed';
  end if;

  select count(*) into v_helper_policies
  from pg_policy pol
  where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%current_user_%'
     or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%current_user_%';

  if v_helper_policies <> 31 then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_policy_contract_changed';
  end if;
end
$preflight$;

create schema private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
revoke all on schema private from service_role;
grant usage on schema private to authenticated;

-- PostgreSQL's built-in PUBLIC EXECUTE default is global. A schema-scoped
-- REVOKE alone cannot subtract it from future functions.
alter default privileges for role postgres
revoke execute on functions from public;
alter default privileges for role postgres in schema private
revoke execute on functions from public, anon, authenticated, service_role;

create function private.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p.id
  from public.user_profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$function$;

create function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p.role
  from public.user_profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$function$;

create function private.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p.organization_id
  from public.user_profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$function$;

create function private.current_user_client_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p.client_id
  from public.user_profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$function$;

create function private.current_user_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select p.candidate_id
  from public.user_profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$function$;

create function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select coalesce(private.current_user_role() = 'admin', false)
$function$;

revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon;
revoke all on all functions in schema private from authenticated;
revoke all on all functions in schema private from service_role;
grant execute on all functions in schema private to authenticated;

alter policy staging_auth_v4_admin_organizations_select
on public.organizations using (private.current_user_is_admin());
alter policy staging_auth_v4_admin_organizations_insert
on public.organizations with check (private.current_user_is_admin());
alter policy staging_auth_v4_admin_organizations_update
on public.organizations using (private.current_user_is_admin()) with check (private.current_user_is_admin());

alter policy staging_auth_v4_admin_user_profiles_select
on public.user_profiles using (private.current_user_is_admin());
alter policy staging_auth_v4_admin_user_profiles_insert
on public.user_profiles with check (private.current_user_is_admin());
alter policy staging_auth_v4_admin_user_profiles_update
on public.user_profiles using (private.current_user_is_admin()) with check (private.current_user_is_admin());

alter policy staging_auth_v4_admin_user_invites_select
on public.user_invites using (private.current_user_is_admin());
alter policy staging_auth_v4_admin_user_invites_insert
on public.user_invites with check (private.current_user_is_admin());
alter policy staging_auth_v4_admin_user_invites_update
on public.user_invites using (private.current_user_is_admin()) with check (private.current_user_is_admin());

alter policy staging_auth_v4_admin_client_memberships_select
on public.client_memberships using (private.current_user_is_admin());
alter policy staging_auth_v4_admin_client_memberships_insert
on public.client_memberships with check (private.current_user_is_admin());
alter policy staging_auth_v4_admin_client_memberships_update
on public.client_memberships using (private.current_user_is_admin()) with check (private.current_user_is_admin());

alter policy staging_auth_v4_admin_candidate_accounts_select
on public.candidate_accounts using (private.current_user_is_admin());
alter policy staging_auth_v4_admin_candidate_accounts_insert
on public.candidate_accounts with check (private.current_user_is_admin());
alter policy staging_auth_v4_admin_candidate_accounts_update
on public.candidate_accounts using (private.current_user_is_admin()) with check (private.current_user_is_admin());

alter policy staging_auth_v4_admin_access_audit_logs_select
on public.access_audit_logs using (private.current_user_is_admin());
alter policy staging_auth_v4_admin_bootstrap_provenance_select
on public.staging_auth_bootstrap_provenance using (private.current_user_is_admin());

alter policy staging_auth_v4_recruiter_manager_organizations_select
on public.organizations using (
  private.current_user_role() = 'recruiter_manager'
  and id = private.current_user_organization_id()
);
alter policy staging_auth_v4_recruiter_manager_user_profiles_self_select
on public.user_profiles using (
  private.current_user_role() = 'recruiter_manager'
  and id = private.current_user_profile_id()
  and status = 'active'
);
alter policy staging_auth_v4_recruiter_manager_user_profiles_self_update
on public.user_profiles
using (
  private.current_user_role() = 'recruiter_manager'
  and id = private.current_user_profile_id()
  and status = 'active'
)
with check (
  private.current_user_role() = 'recruiter_manager'
  and id = private.current_user_profile_id()
  and status = 'active'
);

alter policy staging_auth_v4_recruiter_organizations_select
on public.organizations using (
  private.current_user_role() = 'recruiter'
  and id = private.current_user_organization_id()
  and organization_type = 'internal'
);
alter policy staging_auth_v4_recruiter_user_profiles_select
on public.user_profiles using (
  private.current_user_role() = 'recruiter'
  and id = private.current_user_profile_id()
  and status = 'active'
);
alter policy staging_auth_v4_recruiter_user_profiles_update
on public.user_profiles
using (
  private.current_user_role() = 'recruiter'
  and id = private.current_user_profile_id()
  and status = 'active'
)
with check (
  private.current_user_role() = 'recruiter'
  and id = private.current_user_profile_id()
  and status = 'active'
);

alter policy staging_auth_v4_client_organizations_select
on public.organizations using (
  private.current_user_role() = 'client'
  and id = private.current_user_organization_id()
  and organization_type = 'client'
);
alter policy staging_auth_v4_client_user_profiles_select
on public.user_profiles using (
  private.current_user_role() = 'client'
  and id = private.current_user_profile_id()
  and status = 'active'
);
alter policy staging_auth_v4_client_user_profiles_update
on public.user_profiles
using (
  private.current_user_role() = 'client'
  and id = private.current_user_profile_id()
  and status = 'active'
)
with check (
  private.current_user_role() = 'client'
  and id = private.current_user_profile_id()
  and status = 'active'
);
alter policy staging_auth_v4_client_client_memberships_select
on public.client_memberships using (
  private.current_user_role() = 'client'
  and status = 'active'
  and user_profile_id = private.current_user_profile_id()
  and organization_id = private.current_user_organization_id()
  and client_id = private.current_user_client_id()
);

alter policy staging_auth_v4_candidate_user_profiles_select
on public.user_profiles using (
  private.current_user_role() = 'candidate'
  and id = private.current_user_profile_id()
  and status = 'active'
);
alter policy staging_auth_v4_candidate_user_profiles_update
on public.user_profiles
using (
  private.current_user_role() = 'candidate'
  and id = private.current_user_profile_id()
  and status = 'active'
)
with check (
  private.current_user_role() = 'candidate'
  and id = private.current_user_profile_id()
  and status = 'active'
);
alter policy staging_auth_v4_candidate_candidate_accounts_select
on public.candidate_accounts using (
  private.current_user_role() = 'candidate'
  and status = 'active'
  and user_profile_id = private.current_user_profile_id()
  and candidate_id = private.current_user_candidate_id()
);

alter policy candidate_security_fixture_candidate_reads_own_record
on public.candidate_security_fixture using (
  private.current_user_role() = 'candidate'
  and id = private.current_user_candidate_id()
);

create or replace function public.guard_user_profile_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if private.current_user_profile_id() is null then
    raise exception using errcode = '42501', message = 'profile_update_denied';
  end if;

  if not private.current_user_is_admin() and (
    new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.auth_user_id is distinct from old.auth_user_id
    or new.organization_id is distinct from old.organization_id
    or new.client_id is distinct from old.client_id
    or new.candidate_id is distinct from old.candidate_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception using errcode = '42501', message = 'protected_profile_change_denied';
  end if;

  return new;
end
$function$;

alter function public.current_user_profile_id() security invoker;
alter function public.current_user_role() security invoker;
alter function public.current_user_organization_id() security invoker;
alter function public.current_user_client_id() security invoker;
alter function public.current_user_candidate_id() security invoker;
alter function public.current_user_is_admin() security invoker;

revoke all on function public.current_user_profile_id() from public, anon, authenticated, service_role;
revoke all on function public.current_user_role() from public, anon, authenticated, service_role;
revoke all on function public.current_user_organization_id() from public, anon, authenticated, service_role;
revoke all on function public.current_user_client_id() from public, anon, authenticated, service_role;
revoke all on function public.current_user_candidate_id() from public, anon, authenticated, service_role;
revoke all on function public.current_user_is_admin() from public, anon, authenticated, service_role;

do $postcondition$
declare
  v_private_helpers integer;
  v_public_definers integer;
  v_public_authenticated_execute integer;
  v_public_policy_refs integer;
  v_private_policy_refs integer;
  v_private_using_refs integer;
  v_private_check_refs integer;
  v_private_default_execute integer;
  v_global_public_default_execute integer;
  v_guard_definition text;
begin
  select count(*) into v_private_helpers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = any (array[
      'current_user_profile_id',
      'current_user_role',
      'current_user_organization_id',
      'current_user_client_id',
      'current_user_candidate_id',
      'current_user_is_admin'
    ])
    and p.pronargs = 0
    and p.prosecdef
    and p.proconfig = array['search_path=pg_catalog']
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and not has_function_privilege('service_role', p.oid, 'EXECUTE');

  if v_private_helpers <> 6 then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_definition_postcondition_failed';
  end if;

  if exists (
       select 1
       from pg_namespace n
       cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
       where n.nspname = 'private'
         and acl.grantee = 0
         and acl.privilege_type = 'USAGE'
     )
     or has_schema_privilege('anon', 'private', 'USAGE')
     or has_schema_privilege('service_role', 'private', 'USAGE')
     or not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_schema_grant_postcondition_failed';
  end if;

  select count(*) into v_private_default_execute
  from pg_default_acl d
  cross join lateral aclexplode(
    coalesce(d.defaclacl, acldefault('f', d.defaclrole))
  ) acl
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace = 'private'::regnamespace
    and d.defaclobjtype = 'f'
    and acl.privilege_type = 'EXECUTE'
    and acl.grantee in (
      0,
      'anon'::regrole,
      'authenticated'::regrole,
      'service_role'::regrole
    );

  select count(*) into v_global_public_default_execute
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) acl
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace = 0
    and d.defaclobjtype = 'f'
    and acl.privilege_type = 'EXECUTE'
    and acl.grantee = 0;

  if not exists (
       select 1
       from pg_default_acl d
       where d.defaclrole = 'postgres'::regrole
         and d.defaclnamespace = 0
         and d.defaclobjtype = 'f'
     )
     or v_global_public_default_execute <> 0
     or v_private_default_execute <> 0 then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_default_privilege_postcondition_failed';
  end if;

  select
    count(*) filter (where p.prosecdef),
    count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  into v_public_definers, v_public_authenticated_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any (array[
      'current_user_profile_id',
      'current_user_role',
      'current_user_organization_id',
      'current_user_client_id',
      'current_user_candidate_id',
      'current_user_is_admin'
    ])
    and p.pronargs = 0;

  if v_public_definers <> 0 or v_public_authenticated_execute <> 0 then
    raise exception using errcode = 'P0001', message = 'staging_public_helper_rpc_postcondition_failed';
  end if;

  select
    count(*) filter (
      where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%public.current_user_%'
         or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%public.current_user_%'
    ),
    count(*) filter (
      where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%private.current_user_%'
         or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%private.current_user_%'
    ),
    count(*) filter (where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%private.current_user_%'),
    count(*) filter (where coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%private.current_user_%')
  into v_public_policy_refs, v_private_policy_refs, v_private_using_refs, v_private_check_refs
  from pg_policy pol;

  if v_public_policy_refs <> 0
     or v_private_policy_refs <> 31
     or v_private_using_refs <> 26
     or v_private_check_refs <> 14 then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_policy_postcondition_failed';
  end if;

  select pg_get_functiondef('public.guard_user_profile_protected_columns()'::regprocedure)
  into v_guard_definition;

  if v_guard_definition not like '%private.current_user_profile_id()%'
     or v_guard_definition not like '%private.current_user_is_admin()%'
     or v_guard_definition like '%public.current_user_%' then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_trigger_postcondition_failed';
  end if;
end
$postcondition$;

commit;

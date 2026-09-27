-- STAGING ONLY - READ-ONLY verification after the separately approved patch.

begin;
set transaction read only;

do $readback$
declare
  v_private_helpers integer;
  v_public_definers integer;
  v_public_authenticated_execute integer;
  v_public_policy_refs integer;
  v_private_policy_refs integer;
  v_private_using_refs integer;
  v_private_check_refs integer;
  v_private_default_execute integer;
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
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_definition_readback_failed';
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
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_schema_grant_readback_failed';
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

  if not exists (
       select 1
       from pg_default_acl d
       where d.defaclrole = 'postgres'::regrole
         and d.defaclnamespace = 'private'::regnamespace
         and d.defaclobjtype = 'f'
     )
     or v_private_default_execute <> 0 then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_default_privilege_readback_failed';
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
    raise exception using errcode = 'P0001', message = 'staging_public_helper_rpc_readback_failed';
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
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_policy_readback_failed';
  end if;

  select pg_get_functiondef('public.guard_user_profile_protected_columns()'::regprocedure)
  into v_guard_definition;

  if v_guard_definition not like '%private.current_user_profile_id()%'
     or v_guard_definition not like '%private.current_user_is_admin()%'
     or v_guard_definition like '%public.current_user_%' then
    raise exception using errcode = 'P0001', message = 'staging_private_helpers_trigger_readback_failed';
  end if;
end
$readback$;

rollback;

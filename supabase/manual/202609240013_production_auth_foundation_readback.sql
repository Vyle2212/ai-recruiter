-- READ-ONLY verification after supervised production Auth foundation/bootstrap.
begin transaction isolation level repeatable read read only;

do $readback$
declare
  v_table text;
  v_policy_count integer;
begin
  foreach v_table in array array['organizations','user_profiles','candidate_accounts'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table
        and c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'production_auth_v1_rls_readback_failed';
    end if;
    if has_table_privilege('anon', format('public.%I', v_table), 'select')
       or has_table_privilege('anon', format('public.%I', v_table), 'insert')
       or has_table_privilege('anon', format('public.%I', v_table), 'update')
       or has_table_privilege('anon', format('public.%I', v_table), 'delete') then
      raise exception 'production_auth_v1_anon_privilege_detected';
    end if;
  end loop;

  if not has_table_privilege('authenticated','public.user_profiles','select')
     or has_table_privilege('authenticated','public.user_profiles','insert')
     or has_table_privilege('authenticated','public.user_profiles','update')
     or has_table_privilege('authenticated','public.user_profiles','delete')
     or has_table_privilege('authenticated','public.organizations','select')
     or has_table_privilege('authenticated','public.organizations','insert')
     or has_table_privilege('authenticated','public.organizations','update')
     or has_table_privilege('authenticated','public.organizations','delete')
     or has_table_privilege('authenticated','public.candidate_accounts','select')
     or has_table_privilege('authenticated','public.candidate_accounts','insert')
     or has_table_privilege('authenticated','public.candidate_accounts','update')
     or has_table_privilege('authenticated','public.candidate_accounts','delete') then
    raise exception 'production_auth_v1_browser_privilege_readback_failed';
  end if;
  if has_schema_privilege('anon','private','usage')
     or has_schema_privilege('authenticated','private','usage')
     or has_table_privilege('anon','private.production_auth_bootstrap_provenance','select')
     or has_table_privilege('authenticated','private.production_auth_bootstrap_provenance','select') then
    raise exception 'production_auth_v1_private_surface_exposed';
  end if;

  select count(*) into v_policy_count from pg_policies
  where schemaname = 'public' and tablename in ('organizations','user_profiles','candidate_accounts');
  if v_policy_count <> 1 or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles'
      and policyname = 'production_auth_v1_user_profiles_self_select'
      and cmd = 'SELECT' and roles = array['authenticated']::name[]
      and qual like '%auth.uid()%auth_user_id%'
  ) then
    raise exception 'production_auth_v1_policy_readback_failed';
  end if;

  if (select count(*) from private.production_auth_bootstrap_provenance) <> 1
     or (select count(*) from public.user_profiles where role = 'admin' and status = 'active') <> 1 then
    raise exception 'production_auth_v1_initial_owner_readback_failed';
  end if;
  if not exists (
    select 1
    from private.production_auth_bootstrap_provenance b
    join public.user_profiles p on p.id = b.admin_profile_id
    join auth.users u on u.id = b.auth_user_id
    where p.auth_user_id = b.auth_user_id
      and p.organization_id = b.organization_id
      and p.role = 'admin' and p.status = 'active'
      and u.email_confirmed_at is not null
      and lower(btrim(u.email)) = b.normalized_admin_email
      and lower(btrim(p.email)) = b.normalized_admin_email
  ) then
    raise exception 'production_auth_v1_initial_owner_identity_readback_failed';
  end if;

  if exists (
    select 1 from public.candidate_accounts a
    join public.user_profiles p on p.id = a.user_profile_id
    where p.role <> 'candidate' or p.status <> 'active'
      or p.candidate_id is distinct from a.candidate_id
  ) then
    raise exception 'production_auth_v1_candidate_ownership_mismatch';
  end if;
  if to_regprocedure('private.claim_candidate_profile()') is not null
     and (
       has_function_privilege('anon',to_regprocedure('private.claim_candidate_profile()'),'execute')
       or has_function_privilege('authenticated',to_regprocedure('private.claim_candidate_profile()'),'execute')
     ) then
    raise exception 'production_auth_v1_claim_exposed_before_acceptance';
  end if;
end
$readback$;

rollback;

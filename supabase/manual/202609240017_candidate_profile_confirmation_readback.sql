-- READ-ONLY. Run after 202609240016_candidate_profile_confirmation.sql.
do $readback$
declare
  v_function oid := to_regprocedure(
    'public.apply_candidate_profile_confirmation(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,boolean,boolean,jsonb,jsonb)'
  );
  v_definition text;
  v_config text[];
  v_security_definer boolean;
begin
  if v_function is null then
    raise exception 'candidate_profile_confirmation_function_missing';
  end if;
  select pg_get_functiondef(v_function), p.proconfig, p.prosecdef
    into v_definition, v_config, v_security_definer
  from pg_catalog.pg_proc p where p.oid = v_function;
  if v_security_definer or not coalesce(v_config, '{}'::text[]) @> array['search_path='] then
    raise exception 'candidate_profile_confirmation_function_security_invalid';
  end if;
  if has_function_privilege('public', v_function, 'execute')
     or has_function_privilege('anon', v_function, 'execute')
     or has_function_privilege('authenticated', v_function, 'execute')
     or not has_function_privilege('service_role', v_function, 'execute') then
    raise exception 'candidate_profile_confirmation_function_acl_invalid';
  end if;
  if v_definition not like '%profile_confirmation_status = ''candidate_confirmed''%'
     or v_definition not like '%candidate_confirmed_at = p_confirmed_at%'
     or v_definition not like '%extraction_coverage_status = ''complete_for_validation''%'
     or v_definition not like '%coalesce(c.profile_source_state, ''{}''::jsonb)%'
     or v_definition not like '%delete from public.candidate_search_index%'
     or v_definition not like '%insert into public.candidate_search_index%'
     or v_definition not like '%candidate_profile_confirmation_employment_incomplete%'
     or v_definition not like '%candidate_profile_confirmation_project_incomplete%'
     or v_definition not like '%candidate_profile_confirmation_verified_email_mismatch%' then
    raise exception 'candidate_profile_confirmation_transaction_contract_invalid';
  end if;
  if exists (
    select 1
    from (values
      ('public.candidates'::regclass),
      ('public.candidate_search_index'::regclass),
      ('public.user_profiles'::regclass),
      ('public.candidate_accounts'::regclass)
    ) required(relation_oid)
    join pg_catalog.pg_class c on c.oid = required.relation_oid
    where not c.relrowsecurity or not c.relforcerowsecurity
  ) then
    raise exception 'candidate_profile_confirmation_forced_rls_readback_failed';
  end if;
  raise notice 'candidate_profile_confirmation_readback_passed';
end
$readback$;

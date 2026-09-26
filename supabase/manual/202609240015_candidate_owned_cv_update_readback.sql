-- Read-only verification after separately approved installation of 014.
begin transaction isolation level repeatable read read only;

do $readback$
declare
  v_function regprocedure := to_regprocedure(
    'public.apply_candidate_owned_cv_update(uuid,uuid,uuid,timestamp with time zone,jsonb)'
  );
  v_security_definer boolean;
  v_config text[];
begin
  if v_function is null then
    raise exception 'candidate_owned_cv_function_missing';
  end if;
  if has_function_privilege('anon', v_function, 'execute')
     or has_function_privilege('authenticated', v_function, 'execute') then
    raise exception 'candidate_owned_cv_function_exposed';
  end if;
  if not has_function_privilege('service_role', v_function, 'execute') then
    raise exception 'candidate_owned_cv_service_role_execute_missing';
  end if;

  select p.prosecdef, p.proconfig into v_security_definer, v_config
  from pg_catalog.pg_proc p where p.oid = v_function::oid;
  if v_security_definer then
    raise exception 'candidate_owned_cv_must_be_security_invoker';
  end if;
  if not coalesce(v_config, array[]::text[]) @> array['search_path=']::text[] then
    raise exception 'candidate_owned_cv_search_path_not_empty';
  end if;

  if exists (
    select 1
    from (values
      ('profile_confirmation_status'),
      ('profile_source_state'),
      ('candidate_confirmed_at'),
      ('extraction_coverage'),
      ('extraction_coverage_status'),
      ('profile_source_type'),
      ('source_file'),
      ('updated_at'),
      ('cv_version')
    ) required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'candidates'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'candidate_owned_cv_required_column_missing';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_function::oid
      and pg_get_functiondef(p.oid) like '%for update%'
      and pg_get_functiondef(p.oid) like '%candidate_owned_cv_stale_version%'
      and pg_get_functiondef(p.oid) like '%profile_confirmation_status = ''claimed_incomplete''%'
      and pg_get_functiondef(p.oid) like '%delete from public.candidate_search_index%'
  ) then
    raise exception 'candidate_owned_cv_transaction_contract_invalid';
  end if;
end
$readback$;

commit;

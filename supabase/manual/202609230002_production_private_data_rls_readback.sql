-- READ-ONLY POST-CUTOVER VERIFICATION.
-- Run only after 202609230001_production_private_data_rls_cutover.sql commits.
-- This script changes no database state. Any unmet boundary raises an exception.

do $$
declare
  target_table text;
  target_view text;
  function_signature text;
  role_name text;
  privilege_name text;
  object_oid oid;
  row_security boolean;
  force_row_security boolean;
  relation_options text[];
  function_config text[];
  function_security_definer boolean;
  target_tables constant text[] := array[
    'jobs', 'candidates', 'saved_matches', 'saved_candidates',
    'recruiter_notes', 'shortlisted', 'candidate_emails', 'emails',
    'matches', 'rejected', 'interviewed', 'hired', 'candidates_backup',
    'talent_pools', 'talent_pool_candidates', 'shortlists',
    'shortlist_candidates', 'consulting_firms_backup', 'sap_module_aliases',
    'consulting_aliases', 'taxonomy_review_queue', 'candidate_search_index',
    'salary_market_snapshot', 'sap_modules', 'consulting_firms'
  ];
  target_views constant text[] := array[
    'candidate_audit_view', 'candidate_quality_audit'
  ];
  target_functions constant text[] := array[
    'public.match_candidates(public.vector,double precision,integer)',
    'public.match_job_candidates(public.vector,double precision,integer)',
    'public.sap_detect_modules_from_text(text)',
    'public.search_candidate_index(text,text[],text,text,numeric,boolean,integer,integer)',
    'public.search_candidate_index_v2(text,text[],text,text,numeric,boolean,integer,integer)',
    'public.search_candidate_index_vector(public.vector,text[],text,numeric,boolean,integer)'
  ];
begin
  foreach target_table in array target_tables loop
    select c.oid, c.relrowsecurity, c.relforcerowsecurity
      into object_oid, row_security, force_row_security
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = target_table
      and c.relkind in ('r', 'p');

    if object_oid is null then
      raise exception 'RLS readback failed: missing table public.%', target_table;
    end if;
    if not row_security or not force_row_security then
      raise exception 'RLS readback failed: public.% is not enable+force RLS', target_table;
    end if;
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = target_table
    ) then
      raise exception 'RLS readback failed: public.% still has a policy', target_table;
    end if;

    foreach role_name in array array['anon', 'authenticated'] loop
      foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
        if has_table_privilege(role_name, object_oid, privilege_name) then
          raise exception 'RLS readback failed: % retains % on public.%',
            role_name, privilege_name, target_table;
        end if;
      end loop;
    end loop;

    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not has_table_privilege('service_role', object_oid, privilege_name) then
        raise exception 'RLS readback failed: service_role lacks % on public.%',
          privilege_name, target_table;
      end if;
    end loop;
  end loop;

  foreach target_view in array target_views loop
    select c.oid, c.reloptions
      into object_oid, relation_options
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = target_view
      and c.relkind = 'v';

    if object_oid is null then
      raise exception 'View readback failed: missing public.%', target_view;
    end if;
    if not (
      coalesce(relation_options, array[]::text[])
      @> array['security_invoker=true']
    ) then
      raise exception 'View readback failed: public.% is not security_invoker',
        target_view;
    end if;
    if has_table_privilege('anon', object_oid, 'SELECT')
      or has_table_privilege('authenticated', object_oid, 'SELECT') then
      raise exception 'View readback failed: public.% remains directly selectable',
        target_view;
    end if;
    if not has_table_privilege('service_role', object_oid, 'SELECT') then
      raise exception 'View readback failed: service_role cannot select public.%',
        target_view;
    end if;
  end loop;

  foreach function_signature in array target_functions loop
    object_oid := to_regprocedure(function_signature);
    if object_oid is null then
      raise exception 'RPC readback failed: missing %', function_signature;
    end if;

    select p.proconfig, p.prosecdef
      into function_config, function_security_definer
    from pg_proc p
    where p.oid = object_oid;

    if not (
      coalesce(function_config, array[]::text[])
      @> array['search_path=pg_catalog, public']
    ) then
      raise exception 'RPC readback failed: mutable search_path on %',
        function_signature;
    end if;
    if function_security_definer then
      raise exception 'RPC readback failed: % is security definer',
        function_signature;
    end if;
    if has_function_privilege('anon', object_oid, 'EXECUTE')
      or has_function_privilege('authenticated', object_oid, 'EXECUTE') then
      raise exception 'RPC readback failed: % remains directly executable',
        function_signature;
    end if;
    if not has_function_privilege('service_role', object_oid, 'EXECUTE') then
      raise exception 'RPC readback failed: service_role cannot execute %',
        function_signature;
    end if;
  end loop;
end
$$;

select 'private_database_surface_readback_passed' as verification,
       25 as tables_verified,
       2 as views_verified,
       6 as functions_verified;

-- MANUAL PRODUCTION CUTOVER. Do not run before the matching application SHA
-- has passed authenticated acceptance with the server-only legacy API client.
-- This migration intentionally removes browser/anon access to private recruiter
-- and candidate tables. Recruiter access continues through authorized server
-- routes using a service-role client.
-- Required first: verify a version-matched data backup and retain the JSON from
-- 202609230000_production_private_data_rls_snapshot.sql. The metadata snapshot
-- is evidence for rollback review; it is not a substitute for the data backup.

begin;

do $$
declare
  required_table text;
  required_view text;
  required_function text;
  required_tables constant text[] := array[
    'jobs', 'candidates', 'saved_matches', 'saved_candidates',
    'recruiter_notes', 'shortlisted', 'candidate_emails', 'emails',
    'matches', 'rejected', 'interviewed', 'hired', 'candidates_backup',
    'talent_pools', 'talent_pool_candidates', 'shortlists',
    'shortlist_candidates', 'consulting_firms_backup', 'sap_module_aliases',
    'consulting_aliases', 'taxonomy_review_queue', 'candidate_search_index',
    'salary_market_snapshot', 'sap_modules', 'consulting_firms'
  ];
  required_views constant text[] := array[
    'candidate_audit_view', 'candidate_quality_audit'
  ];
  required_functions constant text[] := array[
    'public.match_candidates(public.vector,double precision,integer)',
    'public.match_job_candidates(public.vector,double precision,integer)',
    'public.sap_detect_modules_from_text(text)',
    'public.search_candidate_index(text,text[],text,text,numeric,boolean,integer,integer)',
    'public.search_candidate_index_v2(text,text[],text,text,numeric,boolean,integer,integer)',
    'public.search_candidate_index_vector(public.vector,text[],text,numeric,boolean,integer)'
  ];
begin
  foreach required_table in array required_tables loop
    if to_regclass(format('public.%I', required_table)) is null then
      raise exception 'RLS cutover refused: missing public.%', required_table;
    end if;
  end loop;

  foreach required_view in array required_views loop
    if to_regclass(format('public.%I', required_view)) is null then
      raise exception 'RLS cutover refused: missing public.%', required_view;
    end if;
  end loop;

  foreach required_function in array required_functions loop
    if to_regprocedure(required_function) is null then
      raise exception 'RLS cutover refused: missing function %', required_function;
    end if;
  end loop;
end
$$;

do $$
declare
  target_table text;
  existing_policy record;
  target_tables constant text[] := array[
    'jobs', 'candidates', 'saved_matches', 'saved_candidates',
    'recruiter_notes', 'shortlisted', 'candidate_emails', 'emails',
    'matches', 'rejected', 'interviewed', 'hired', 'candidates_backup',
    'talent_pools', 'talent_pool_candidates', 'shortlists',
    'shortlist_candidates', 'consulting_firms_backup', 'sap_module_aliases',
    'consulting_aliases', 'taxonomy_review_queue', 'candidate_search_index',
    'salary_market_snapshot', 'sap_modules', 'consulting_firms'
  ];
begin
  foreach target_table in array target_tables loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format(
        'drop policy %I on public.%I',
        existing_policy.policyname,
        target_table
      );
    end loop;

    execute format('alter table public.%I enable row level security', target_table);
    execute format('alter table public.%I force row level security', target_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', target_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', target_table);
  end loop;
end
$$;

-- These audit views currently run with their owner's privileges. Make the
-- caller's privileges and the underlying tables' RLS authoritative, then keep
-- the views behind server-side service-role access.
alter view public.candidate_audit_view set (security_invoker = true);
alter view public.candidate_quality_audit set (security_invoker = true);
revoke all on table public.candidate_audit_view from public, anon, authenticated;
revoke all on table public.candidate_quality_audit from public, anon, authenticated;
grant select on table public.candidate_audit_view to service_role;
grant select on table public.candidate_quality_audit to service_role;

-- Every candidate RPC is invoked only by authorized server routes. Pin the
-- resolution path and remove the default PUBLIC/anon/authenticated EXECUTE
-- privilege so the Data API cannot bypass the application authorization gate.
alter function public.match_candidates(public.vector, double precision, integer)
  set search_path = pg_catalog, public;
alter function public.match_job_candidates(public.vector, double precision, integer)
  set search_path = pg_catalog, public;
alter function public.sap_detect_modules_from_text(text)
  set search_path = pg_catalog, public;
alter function public.search_candidate_index(text, text[], text, text, numeric, boolean, integer, integer)
  set search_path = pg_catalog, public;
alter function public.search_candidate_index_v2(text, text[], text, text, numeric, boolean, integer, integer)
  set search_path = pg_catalog, public;
alter function public.search_candidate_index_vector(public.vector, text[], text, numeric, boolean, integer)
  set search_path = pg_catalog, public;

revoke all on function public.match_candidates(public.vector, double precision, integer) from public, anon, authenticated;
revoke all on function public.match_job_candidates(public.vector, double precision, integer) from public, anon, authenticated;
revoke all on function public.sap_detect_modules_from_text(text) from public, anon, authenticated;
revoke all on function public.search_candidate_index(text, text[], text, text, numeric, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.search_candidate_index_v2(text, text[], text, text, numeric, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.search_candidate_index_vector(public.vector, text[], text, numeric, boolean, integer) from public, anon, authenticated;

grant execute on function public.match_candidates(public.vector, double precision, integer) to service_role;
grant execute on function public.match_job_candidates(public.vector, double precision, integer) to service_role;
grant execute on function public.sap_detect_modules_from_text(text) to service_role;
grant execute on function public.search_candidate_index(text, text[], text, text, numeric, boolean, integer, integer) to service_role;
grant execute on function public.search_candidate_index_v2(text, text[], text, text, numeric, boolean, integer, integer) to service_role;
grant execute on function public.search_candidate_index_vector(public.vector, text[], text, numeric, boolean, integer) to service_role;

commit;

-- Required post-cutover readback (run separately):
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity,
--        has_table_privilege('anon', c.oid, 'select') as anon_select,
--        has_table_privilege('authenticated', c.oid, 'select') as authenticated_select
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = any(array['candidates','candidate_search_index','candidate_emails']);
--
-- select c.relname, c.reloptions,
--        has_table_privilege('anon', c.oid, 'select') as anon_select,
--        has_table_privilege('service_role', c.oid, 'select') as service_select
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname = any(array['candidate_audit_view','candidate_quality_audit']);
--
-- select p.proname, p.proconfig,
--        has_function_privilege('anon', p.oid, 'execute') as anon_execute,
--        has_function_privilege('service_role', p.oid, 'execute') as service_execute
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = any(array[
--   'match_candidates','match_job_candidates','sap_detect_modules_from_text',
--   'search_candidate_index','search_candidate_index_v2','search_candidate_index_vector'
-- ]);

-- MANUAL PRODUCTION CUTOVER. Do not run before the matching application SHA
-- has passed authenticated acceptance with the server-only legacy API client.
-- This migration intentionally removes browser/anon access to private recruiter
-- and candidate tables. Recruiter access continues through authorized server
-- routes using a service-role client.

begin;

do $$
declare
  required_table text;
  required_tables constant text[] := array[
    'jobs', 'candidates', 'saved_matches', 'saved_candidates',
    'recruiter_notes', 'shortlisted', 'candidate_emails', 'emails',
    'matches', 'rejected', 'interviewed', 'hired', 'candidates_backup',
    'talent_pools', 'talent_pool_candidates', 'shortlists',
    'shortlist_candidates', 'consulting_firms_backup', 'sap_module_aliases',
    'consulting_aliases', 'taxonomy_review_queue', 'candidate_search_index',
    'salary_market_snapshot', 'sap_modules', 'consulting_firms'
  ];
begin
  foreach required_table in array required_tables loop
    if to_regclass(format('public.%I', required_table)) is null then
      raise exception 'RLS cutover refused: missing public.%', required_table;
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

commit;

-- Required post-cutover readback (run separately):
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity,
--        has_table_privilege('anon', c.oid, 'select') as anon_select,
--        has_table_privilege('authenticated', c.oid, 'select') as authenticated_select
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = any(array['candidates','candidate_search_index','candidate_emails']);

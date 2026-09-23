-- READ-ONLY PRE-CUTOVER AUTHORIZATION SNAPSHOT.
-- Run and retain the single JSON result immediately before
-- 202609230001_production_private_data_rls_cutover.sql.
-- This captures authorization metadata only. It is not a data backup and does
-- not replace a verified, version-matched production backup/restore point.

begin transaction isolation level repeatable read read only;

do $$
declare
  required_table text;
  required_view text;
  required_function text;
  required_role text;
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
  foreach required_role in array array['anon', 'authenticated', 'service_role'] loop
    if to_regrole(required_role) is null then
      raise exception 'Authorization snapshot refused: missing role %', required_role;
    end if;
  end loop;

  foreach required_table in array required_tables loop
    if to_regclass(format('public.%I', required_table)) is null then
      raise exception 'Authorization snapshot refused: missing public.%', required_table;
    end if;
  end loop;

  foreach required_view in array required_views loop
    if to_regclass(format('public.%I', required_view)) is null then
      raise exception 'Authorization snapshot refused: missing public.%', required_view;
    end if;
  end loop;

  foreach required_function in array required_functions loop
    if to_regprocedure(required_function) is null then
      raise exception 'Authorization snapshot refused: missing function %', required_function;
    end if;
  end loop;
end
$$;

with
target_tables(name) as (
  select unnest(array[
    'jobs', 'candidates', 'saved_matches', 'saved_candidates',
    'recruiter_notes', 'shortlisted', 'candidate_emails', 'emails',
    'matches', 'rejected', 'interviewed', 'hired', 'candidates_backup',
    'talent_pools', 'talent_pool_candidates', 'shortlists',
    'shortlist_candidates', 'consulting_firms_backup', 'sap_module_aliases',
    'consulting_aliases', 'taxonomy_review_queue', 'candidate_search_index',
    'salary_market_snapshot', 'sap_modules', 'consulting_firms'
  ]::text[])
),
target_views(name) as (
  select unnest(array[
    'candidate_audit_view', 'candidate_quality_audit'
  ]::text[])
),
target_functions(signature) as (
  select unnest(array[
    'public.match_candidates(public.vector,double precision,integer)',
    'public.match_job_candidates(public.vector,double precision,integer)',
    'public.sap_detect_modules_from_text(text)',
    'public.search_candidate_index(text,text[],text,text,numeric,boolean,integer,integer)',
    'public.search_candidate_index_v2(text,text[],text,text,numeric,boolean,integer,integer)',
    'public.search_candidate_index_vector(public.vector,text[],text,numeric,boolean,integer)'
  ]::text[])
),
table_state as (
  select jsonb_agg(
    jsonb_build_object(
      'name', format('%I.%I', n.nspname, c.relname),
      'owner', pg_get_userbyid(c.relowner),
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'acl', coalesce(to_jsonb(c.relacl), '[]'::jsonb),
      'effective_privileges', jsonb_build_object(
        'anon', jsonb_build_object(
          'select', has_table_privilege('anon', c.oid, 'SELECT'),
          'insert', has_table_privilege('anon', c.oid, 'INSERT'),
          'update', has_table_privilege('anon', c.oid, 'UPDATE'),
          'delete', has_table_privilege('anon', c.oid, 'DELETE')
        ),
        'authenticated', jsonb_build_object(
          'select', has_table_privilege('authenticated', c.oid, 'SELECT'),
          'insert', has_table_privilege('authenticated', c.oid, 'INSERT'),
          'update', has_table_privilege('authenticated', c.oid, 'UPDATE'),
          'delete', has_table_privilege('authenticated', c.oid, 'DELETE')
        ),
        'service_role', jsonb_build_object(
          'select', has_table_privilege('service_role', c.oid, 'SELECT'),
          'insert', has_table_privilege('service_role', c.oid, 'INSERT'),
          'update', has_table_privilege('service_role', c.oid, 'UPDATE'),
          'delete', has_table_privilege('service_role', c.oid, 'DELETE')
        )
      )
    ) order by c.relname
  ) as value
  from target_tables t
  join pg_class c on c.oid = to_regclass(format('public.%I', t.name))
  join pg_namespace n on n.oid = c.relnamespace
),
policy_state as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', format('%I.%I', p.schemaname, p.tablename),
        'name', p.policyname,
        'permissive', p.permissive,
        'roles', to_jsonb(p.roles),
        'command', p.cmd,
        'using', p.qual,
        'with_check', p.with_check
      ) order by p.tablename, p.policyname
    ),
    '[]'::jsonb
  ) as value
  from pg_policies p
  join target_tables t on t.name = p.tablename
  where p.schemaname = 'public'
),
view_state as (
  select jsonb_agg(
    jsonb_build_object(
      'name', format('%I.%I', n.nspname, c.relname),
      'owner', pg_get_userbyid(c.relowner),
      'options', coalesce(to_jsonb(c.reloptions), '[]'::jsonb),
      'acl', coalesce(to_jsonb(c.relacl), '[]'::jsonb),
      'effective_privileges', jsonb_build_object(
        'anon_select', has_table_privilege('anon', c.oid, 'SELECT'),
        'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
        'service_role_select', has_table_privilege('service_role', c.oid, 'SELECT')
      )
    ) order by c.relname
  ) as value
  from target_views v
  join pg_class c on c.oid = to_regclass(format('public.%I', v.name))
  join pg_namespace n on n.oid = c.relnamespace
),
function_state as (
  select jsonb_agg(
    jsonb_build_object(
      'signature', f.signature,
      'owner', pg_get_userbyid(p.proowner),
      'security_definer', p.prosecdef,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
      'acl', coalesce(to_jsonb(p.proacl), '[]'::jsonb),
      'effective_privileges', jsonb_build_object(
        'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
        'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        'service_role_execute', has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
    ) order by f.signature
  ) as value
  from target_functions f
  join pg_proc p on p.oid = to_regprocedure(f.signature)
)
select jsonb_pretty(
  jsonb_build_object(
    'artifact', 'production_private_data_authorization_snapshot_v1',
    'captured_at', transaction_timestamp(),
    'database', current_database(),
    'captured_by', current_user,
    'server_version', current_setting('server_version'),
    'tables', table_state.value,
    'policies', policy_state.value,
    'views', view_state.value,
    'functions', function_state.value
  )
) as authorization_snapshot
from table_state, policy_state, view_state, function_state;

commit;

-- Read-only gate after the reviewed migration. A zero-row result means ready.
with target as (
  select to_regclass('public.candidate_ingestion_jobs') as oid
), expected_columns(name) as (
  values ('id'), ('actor_user_id'), ('source_file'), ('original_filename'),
         ('content_sha256'), ('parser_revision'), ('byte_size'), ('status'), ('attempts'),
         ('lease_token'), ('lease_expires_at'), ('available_at'),
         ('result_candidate_id'), ('outcome_code'), ('created_at'), ('updated_at')
), missing_columns as (
  select name from expected_columns, target
  where not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = target.oid and attname = name and not attisdropped
  )
), missing_functions as (
  select name from (values
    ('public.enqueue_candidate_ingestion_job(uuid,text,text,text,text,integer)'),
    ('public.claim_candidate_ingestion_jobs(integer)'),
    ('public.renew_candidate_ingestion_job(uuid,uuid)'),
    ('public.finish_candidate_ingestion_job(uuid,uuid,text,uuid,text)')
  ) required(name)
  where to_regprocedure(name) is null
), missing_constraints as (
  select name from (values
    ('candidate_ingestion_jobs_actor_digest_unique'),
    ('candidate_ingestion_jobs_source_revision_unique'),
    ('candidate_ingestion_jobs_lease_check'),
    ('candidate_ingestion_jobs_status_check')
  ) required(name), target
  where not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = target.oid and conname = name
  )
)
select 'table_missing' as finding, 'candidate_ingestion_jobs' as detail
from target where oid is null
union all
select 'column_missing', name from missing_columns
union all
select 'function_missing', name from missing_functions
union all
select 'constraint_missing', name from missing_constraints
union all
select 'rls_not_forced', 'candidate_ingestion_jobs'
from target join pg_catalog.pg_class c on c.oid = target.oid
where not c.relrowsecurity or not c.relforcerowsecurity
union all
select 'browser_table_privilege', role_name
from target cross join (values ('anon'), ('authenticated')) roles(role_name)
where target.oid is not null
  and (has_table_privilege(role_name, target.oid, 'select')
    or has_table_privilege(role_name, target.oid, 'insert')
    or has_table_privilege(role_name, target.oid, 'update'))
union all
select 'service_table_privilege_missing', 'candidate_ingestion_jobs'
from target where oid is not null
  and not (has_table_privilege('service_role', oid, 'select')
    and has_table_privilege('service_role', oid, 'insert')
    and has_table_privilege('service_role', oid, 'update'))
union all
select 'browser_function_privilege', role_name || ':' || function_name
from (values ('anon'), ('authenticated')) roles(role_name)
cross join (values
  ('public.enqueue_candidate_ingestion_job(uuid,text,text,text,text,integer)'),
  ('public.claim_candidate_ingestion_jobs(integer)'),
  ('public.renew_candidate_ingestion_job(uuid,uuid)'),
  ('public.finish_candidate_ingestion_job(uuid,uuid,text,uuid,text)')
) functions(function_name)
where to_regprocedure(function_name) is not null
  and has_function_privilege(role_name, to_regprocedure(function_name), 'execute')
union all
select 'service_function_privilege_missing', function_name
from (values
  ('public.enqueue_candidate_ingestion_job(uuid,text,text,text,text,integer)'),
  ('public.claim_candidate_ingestion_jobs(integer)'),
  ('public.renew_candidate_ingestion_job(uuid,uuid)'),
  ('public.finish_candidate_ingestion_job(uuid,uuid,text,uuid,text)')
) functions(function_name)
where to_regprocedure(function_name) is not null
  and not has_function_privilege(
    'service_role', to_regprocedure(function_name), 'execute'
  );

-- PHASE 5 V6 POST-CLEANUP VERIFICATION
-- READ ONLY. RUN AFTER PUBLIC CLEANUP, BEFORE/AFTER SEPARATE AUTH CLEANUP.
BEGIN;
SET TRANSACTION READ ONLY;

WITH
cfg AS (
  SELECT pg_catalog.convert_from(
    pg_catalog.decode('__STAGING_PHASE5_FIXTURE_CONFIG_B64__','base64'),
    'UTF8'
  )::jsonb AS j
),
config_check AS (
  SELECT
    pg_catalog.jsonb_typeof(j)='object'
    AND (SELECT count(*) FROM pg_catalog.jsonb_object_keys(j))=8
    AND NOT EXISTS(
      SELECT key FROM pg_catalog.jsonb_object_keys(j) supplied(key)
      WHERE key<>ALL(ARRAY[
        'config_version','batch_reference','existing_foundation','auth_users',
        'setup','admin_runtime','denied_attempts','immutable_attempts'
      ])
    )
    AND NOT EXISTS(
      SELECT required FROM unnest(ARRAY[
        'config_version','batch_reference','existing_foundation','auth_users',
        'setup','admin_runtime','denied_attempts','immutable_attempts'
      ]) required WHERE NOT j ? required
    )
    AND j->>'config_version'='phase5-fixtures-v6'
    AND pg_catalog.jsonb_typeof(j->'auth_users')='object'
    AND (SELECT count(*) FROM pg_catalog.jsonb_object_keys(j->'auth_users'))=8
    AND pg_catalog.jsonb_array_length(j#>'{setup,organizations}')=3
    AND pg_catalog.jsonb_array_length(j#>'{setup,profiles}')=6
    AND pg_catalog.jsonb_array_length(j#>'{setup,memberships}')=1
    AND pg_catalog.jsonb_array_length(j#>'{setup,candidate_accounts}')=1
    AND pg_catalog.jsonb_array_length(j#>'{admin_runtime,organizations}')=1
    AND pg_catalog.jsonb_array_length(j#>'{admin_runtime,profiles}')=1
    AND pg_catalog.jsonb_array_length(j#>'{admin_runtime,invites}')=1
    AND pg_catalog.jsonb_array_length(j#>'{admin_runtime,memberships}')=1
    AND pg_catalog.jsonb_array_length(j#>'{admin_runtime,candidate_accounts}')=1
    AS valid
  FROM cfg
),
expected_tables(name) AS (
  VALUES ('organizations'),('user_profiles'),('user_invites'),
    ('client_memberships'),('candidate_accounts'),('access_audit_logs'),
    ('staging_auth_bootstrap_provenance')
),
expected_policies(name,table_name,command) AS (
  VALUES
    ('staging_auth_v4_admin_organizations_select','organizations','SELECT'),
    ('staging_auth_v4_admin_organizations_insert','organizations','INSERT'),
    ('staging_auth_v4_admin_organizations_update','organizations','UPDATE'),
    ('staging_auth_v4_admin_user_profiles_select','user_profiles','SELECT'),
    ('staging_auth_v4_admin_user_profiles_insert','user_profiles','INSERT'),
    ('staging_auth_v4_admin_user_profiles_update','user_profiles','UPDATE'),
    ('staging_auth_v4_admin_user_invites_select','user_invites','SELECT'),
    ('staging_auth_v4_admin_user_invites_insert','user_invites','INSERT'),
    ('staging_auth_v4_admin_user_invites_update','user_invites','UPDATE'),
    ('staging_auth_v4_admin_client_memberships_select','client_memberships','SELECT'),
    ('staging_auth_v4_admin_client_memberships_insert','client_memberships','INSERT'),
    ('staging_auth_v4_admin_client_memberships_update','client_memberships','UPDATE'),
    ('staging_auth_v4_admin_candidate_accounts_select','candidate_accounts','SELECT'),
    ('staging_auth_v4_admin_candidate_accounts_insert','candidate_accounts','INSERT'),
    ('staging_auth_v4_admin_candidate_accounts_update','candidate_accounts','UPDATE'),
    ('staging_auth_v4_admin_access_audit_logs_select','access_audit_logs','SELECT'),
    ('staging_auth_v4_admin_bootstrap_provenance_select','staging_auth_bootstrap_provenance','SELECT'),
    ('staging_auth_v4_recruiter_manager_organizations_select','organizations','SELECT'),
    ('staging_auth_v4_recruiter_manager_user_profiles_self_select','user_profiles','SELECT'),
    ('staging_auth_v4_recruiter_manager_user_profiles_self_update','user_profiles','UPDATE'),
    ('staging_auth_v4_recruiter_organizations_select','organizations','SELECT'),
    ('staging_auth_v4_recruiter_user_profiles_select','user_profiles','SELECT'),
    ('staging_auth_v4_recruiter_user_profiles_update','user_profiles','UPDATE'),
    ('staging_auth_v4_client_organizations_select','organizations','SELECT'),
    ('staging_auth_v4_client_user_profiles_select','user_profiles','SELECT'),
    ('staging_auth_v4_client_user_profiles_update','user_profiles','UPDATE'),
    ('staging_auth_v4_client_client_memberships_select','client_memberships','SELECT'),
    ('staging_auth_v4_candidate_user_profiles_select','user_profiles','SELECT'),
    ('staging_auth_v4_candidate_user_profiles_update','user_profiles','UPDATE'),
    ('staging_auth_v4_candidate_candidate_accounts_select','candidate_accounts','SELECT')
),
actual_policies AS (
  SELECT policyname name,tablename table_name,cmd command,roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename IN(SELECT name FROM expected_tables)
),
policy_check AS (
  SELECT
    count(*)=30
    AND NOT EXISTS(
      SELECT name,table_name,command FROM expected_policies
      EXCEPT SELECT name,table_name,command FROM actual_policies
    )
    AND NOT EXISTS(
      SELECT name,table_name,command FROM actual_policies
      EXCEPT SELECT name,table_name,command FROM expected_policies
    )
    AND pg_catalog.bool_and(roles=ARRAY['authenticated'::name])
    AND count(*) FILTER(WHERE command='DELETE')=0
    AND count(*) FILTER(WHERE roles && ARRAY['anon'::name,'public'::name])=0
    AND count(*) FILTER(
      WHERE table_name='access_audit_logs' AND command<>'SELECT'
    )=0
    AND count(*) FILTER(
      WHERE table_name='staging_auth_bootstrap_provenance'
        AND command<>'SELECT'
    )=0
    AS valid
  FROM actual_policies
),
expected_functions(name,authenticated_allowed) AS (
  VALUES
    ('set_staging_auth_updated_at',false),
    ('current_user_profile_id',true),
    ('current_user_role',true),
    ('current_user_organization_id',true),
    ('current_user_client_id',true),
    ('current_user_candidate_id',true),
    ('current_user_is_admin',true),
    ('guard_user_profile_protected_columns',false),
    ('reject_access_audit_log_mutation',false)
),
actual_functions AS (
  SELECT p.oid,p.proname,p.proacl,p.proowner
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.pronargs=0
    AND p.proname IN(SELECT name FROM expected_functions)
),
function_check AS (
  SELECT
    count(*)=9
    AND NOT EXISTS(
      SELECT name FROM expected_functions
      EXCEPT SELECT proname FROM actual_functions
    )
    AND pg_catalog.bool_and(
      pg_catalog.has_function_privilege(
        'authenticated',a.oid,'EXECUTE'
      )=e.authenticated_allowed
    )
    AND pg_catalog.bool_and(
      NOT pg_catalog.has_function_privilege('anon',a.oid,'EXECUTE')
    )
    AND pg_catalog.bool_and(
      NOT pg_catalog.has_function_privilege('service_role',a.oid,'EXECUTE')
    )
    AND pg_catalog.bool_and(NOT EXISTS(
      SELECT 1
      FROM pg_catalog.aclexplode(
        coalesce(a.proacl,pg_catalog.acldefault('f',a.proowner))
      ) x
      WHERE x.grantee=0 AND x.privilege_type='EXECUTE'
    ))
    AS valid
  FROM expected_functions e
  JOIN actual_functions a ON a.proname=e.name
),
expected_triggers(name) AS (
  VALUES
    ('organizations_set_updated_at'),
    ('user_profiles_set_updated_at'),
    ('user_profiles_guard_protected'),
    ('user_invites_set_updated_at'),
    ('client_memberships_set_updated_at'),
    ('candidate_accounts_set_updated_at'),
    ('access_audit_logs_reject_update'),
    ('access_audit_logs_reject_delete')
),
actual_triggers AS (
  SELECT t.tgname name
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D'
    AND c.relname IN(SELECT name FROM expected_tables)
),
trigger_check AS (
  SELECT
    (SELECT count(*) FROM actual_triggers)=8
    AND NOT EXISTS(
      SELECT name FROM expected_triggers
      EXCEPT SELECT name FROM actual_triggers
    )
    AND NOT EXISTS(
      SELECT name FROM actual_triggers
      EXCEPT SELECT name FROM expected_triggers
    )
    AS valid
),
acl_check AS (
  SELECT pg_catalog.bool_and(
    NOT pg_catalog.has_table_privilege(
      'anon',pg_catalog.format('public.%I',name),'SELECT'
    )
    AND NOT pg_catalog.has_table_privilege(
      'anon',pg_catalog.format('public.%I',name),'INSERT'
    )
    AND NOT pg_catalog.has_table_privilege(
      'anon',pg_catalog.format('public.%I',name),'UPDATE'
    )
    AND NOT pg_catalog.has_table_privilege(
      'anon',pg_catalog.format('public.%I',name),'DELETE'
    )
    AND pg_catalog.has_table_privilege(
      'authenticated',pg_catalog.format('public.%I',name),'SELECT'
    )
    AND (
      pg_catalog.has_table_privilege(
        'authenticated',pg_catalog.format('public.%I',name),'INSERT'
      ) = (
        name IN('organizations','user_profiles','user_invites',
          'client_memberships','candidate_accounts')
      )
    )
    AND (
      pg_catalog.has_table_privilege(
        'authenticated',pg_catalog.format('public.%I',name),'UPDATE'
      ) = (
        name IN('organizations','user_profiles','user_invites',
          'client_memberships','candidate_accounts')
      )
    )
    AND NOT pg_catalog.has_table_privilege(
      'authenticated',pg_catalog.format('public.%I',name),'DELETE'
    )
    AND pg_catalog.has_table_privilege(
      'service_role',pg_catalog.format('public.%I',name),'SELECT'
    )
    AND pg_catalog.has_table_privilege(
      'service_role',pg_catalog.format('public.%I',name),'INSERT'
    )
    AND pg_catalog.has_table_privilege(
      'service_role',pg_catalog.format('public.%I',name),'UPDATE'
    )
    AND pg_catalog.has_table_privilege(
      'service_role',pg_catalog.format('public.%I',name),'DELETE'
    )
    AND NOT EXISTS(
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))
      ) x
      WHERE n.nspname='public' AND c.relname=name AND x.grantee=0
        AND x.privilege_type IN('SELECT','INSERT','UPDATE','DELETE')
    )
  ) AS valid
  FROM expected_tables
),
all_configured_id_texts(id_text) AS (
  SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,organizations}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,memberships}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,candidate_accounts}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,organizations}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,profiles}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,invites}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,memberships}') x
  UNION ALL SELECT x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,candidate_accounts}') x
  UNION ALL SELECT d.value#>>'{organization,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT d.value#>>'{profile,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT d.value#>>'{invite,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT d.value#>>'{membership,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT d.value#>>'{candidate_account,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT d.value#>>'{audit,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'immutable_attempts') d
  UNION ALL SELECT d.value#>>'{provenance,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'immutable_attempts') d
),
configured_ids AS (
  SELECT id_text::uuid id FROM all_configured_id_texts
),
fixture_absence AS (
  SELECT
    NOT EXISTS(SELECT 1 FROM public.organizations
      WHERE id IN(SELECT id FROM configured_ids))
    AND NOT EXISTS(SELECT 1 FROM public.user_profiles
      WHERE id IN(SELECT id FROM configured_ids))
    AND NOT EXISTS(SELECT 1 FROM public.user_invites
      WHERE id IN(SELECT id FROM configured_ids))
    AND NOT EXISTS(SELECT 1 FROM public.client_memberships
      WHERE id IN(SELECT id FROM configured_ids))
    AND NOT EXISTS(SELECT 1 FROM public.candidate_accounts
      WHERE id IN(SELECT id FROM configured_ids))
    AND NOT EXISTS(SELECT 1 FROM public.access_audit_logs
      WHERE id IN(SELECT id FROM configured_ids))
    AND NOT EXISTS(SELECT 1 FROM public.staging_auth_bootstrap_provenance
      WHERE id IN(SELECT id FROM configured_ids))
    AS valid
),
foundation_check AS (
  SELECT
    (SELECT count(*) FROM public.organizations)=1
    AND (SELECT count(*) FROM public.user_profiles)=1
    AND (SELECT count(*) FROM public.user_invites)=0
    AND (SELECT count(*) FROM public.client_memberships)=0
    AND (SELECT count(*) FROM public.candidate_accounts)=0
    AND (SELECT count(*) FROM public.access_audit_logs)=0
    AND (SELECT count(*) FROM public.staging_auth_bootstrap_provenance)=1
    AND (
      SELECT count(*)=1
      FROM cfg
      JOIN public.staging_auth_bootstrap_provenance b
        ON b.id=(j#>>'{existing_foundation,provenance_id}')::uuid
      JOIN public.organizations o
        ON o.id=(j#>>'{existing_foundation,organization_id}')::uuid
       AND o.id=b.organization_id
      JOIN public.user_profiles p
        ON p.id=(j#>>'{existing_foundation,profile_id}')::uuid
       AND p.id=b.admin_profile_id
      JOIN auth.users u
        ON u.id=(j#>>'{existing_foundation,auth_user_id}')::uuid
       AND u.id=b.auth_user_id
      WHERE b.bootstrap_type='initial_owner'
        AND o.organization_type='internal' AND o.status='active'
        AND p.role='admin' AND p.status='active'
        AND p.auth_user_id=u.id AND p.organization_id=o.id
        AND p.client_id IS NULL AND p.candidate_id IS NULL
        AND pg_catalog.lower(pg_catalog.btrim(p.email))
          =b.normalized_admin_email
        AND pg_catalog.lower(pg_catalog.btrim(u.email))
          =b.normalized_admin_email
    )
    AS valid
),
structure_check AS (
  SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public'
       AND c.relname IN(SELECT name FROM expected_tables)
       AND c.relrowsecurity)=7
    AND
    (SELECT count(*) FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public'
       AND c.relname IN(SELECT name FROM expected_tables)
       AND c.relforcerowsecurity)=7
    AS valid
),
checks AS (
  SELECT
    current_user='postgres' AS execution_role_is_postgres,
    (SELECT valid FROM config_check) AS config_valid,
    (SELECT valid FROM fixture_absence) AS configured_public_ids_absent,
    (SELECT valid FROM foundation_check) AS existing_foundation_exact,
    (SELECT valid FROM policy_check) AS policies_unchanged,
    (SELECT valid FROM function_check) AS function_privileges_unchanged,
    (SELECT valid FROM trigger_check) AS triggers_unchanged,
    (SELECT valid FROM acl_check) AS acl_unchanged,
    (SELECT valid FROM structure_check) AS rls_structure_unchanged
)
SELECT
  *,
  (SELECT pg_catalog.bool_and(value::boolean)
   FROM LATERAL pg_catalog.jsonb_each_text(
     pg_catalog.to_jsonb(checks)
   ) item(key,value)) AS post_cleanup_valid
FROM checks;

ROLLBACK;

-- PHASE 5 V6 STAGING RUNTIME RLS PREFLIGHT
-- READ ONLY. MANUAL EXECUTION ONLY. DEDICATED STAGING ONLY.
BEGIN;
SET TRANSACTION READ ONLY;

WITH
cfg AS (
  SELECT pg_catalog.convert_from(
    pg_catalog.decode('__STAGING_PHASE5_FIXTURE_CONFIG_B64__','base64'),
    'UTF8'
  )::jsonb AS j
),
required_top_keys(k) AS (
  VALUES ('config_version'),('batch_reference'),('existing_foundation'),
    ('auth_users'),('setup'),('admin_runtime'),('denied_attempts'),
    ('immutable_attempts')
),
required_identity_keys(k) AS (
  VALUES ('no_profile'),('invited_client'),('inactive_candidate'),
    ('active_admin'),('active_recruiter_manager'),('active_recruiter'),
    ('active_client'),('active_candidate')
),
required_all_context_keys(k) AS (
  VALUES ('anon'),('no_profile'),('invited_client'),('active_admin'),
    ('inactive_candidate'),('active_recruiter_manager'),('active_recruiter'),
    ('active_client'),('active_candidate')
),
required_denied_keys(k) AS (
  VALUES ('anon'),('no_profile'),('invited_client'),('inactive_candidate'),
    ('active_recruiter_manager'),('active_recruiter'),('active_client'),
    ('active_candidate')
),
config_shape AS (
  SELECT
    pg_catalog.jsonb_typeof(j)='object'
    AND (SELECT count(*) FROM pg_catalog.jsonb_object_keys(j))=8
    AND NOT EXISTS (
      SELECT k FROM required_top_keys
      EXCEPT SELECT key FROM pg_catalog.jsonb_object_keys(j) supplied(key)
    )
    AND NOT EXISTS (
      SELECT key FROM pg_catalog.jsonb_object_keys(j) supplied(key)
      EXCEPT SELECT k FROM required_top_keys
    )
    AND j->>'config_version'='phase5-fixtures-v6'
    AND pg_catalog.btrim(j->>'batch_reference')<>''
    AND pg_catalog.jsonb_typeof(j->'existing_foundation')='object'
    AND pg_catalog.jsonb_typeof(j->'auth_users')='object'
    AND pg_catalog.jsonb_typeof(j->'setup')='object'
    AND pg_catalog.jsonb_typeof(j->'admin_runtime')='object'
    AND pg_catalog.jsonb_typeof(j->'denied_attempts')='object'
    AND pg_catalog.jsonb_typeof(j->'immutable_attempts')='object'
    AND (SELECT count(*) FROM pg_catalog.jsonb_object_keys(j->'auth_users'))=8
    AND NOT EXISTS (
      SELECT k FROM required_identity_keys
      EXCEPT SELECT key FROM pg_catalog.jsonb_object_keys(j->'auth_users') supplied(key)
    )
    AND (SELECT count(*) FROM pg_catalog.jsonb_object_keys(j->'denied_attempts'))=8
    AND NOT EXISTS (
      SELECT k FROM required_denied_keys
      EXCEPT SELECT key FROM pg_catalog.jsonb_object_keys(j->'denied_attempts') supplied(key)
    )
    AND (SELECT count(*) FROM pg_catalog.jsonb_object_keys(j->'immutable_attempts'))=9
    AND NOT EXISTS (
      SELECT k FROM required_all_context_keys
      EXCEPT SELECT key FROM pg_catalog.jsonb_object_keys(j->'immutable_attempts') supplied(key)
    )
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{setup,organizations}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{setup,organizations}')=3 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{setup,profiles}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{setup,profiles}')=6 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{setup,invites}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{setup,invites}')=0 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{setup,memberships}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{setup,memberships}')=1 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{setup,candidate_accounts}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{setup,candidate_accounts}')=1 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{admin_runtime,organizations}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{admin_runtime,organizations}')=1 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{admin_runtime,profiles}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{admin_runtime,profiles}')=1 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{admin_runtime,invites}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{admin_runtime,invites}')=1 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{admin_runtime,memberships}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{admin_runtime,memberships}')=1 ELSE false END
    AND CASE WHEN pg_catalog.jsonb_typeof(j#>'{admin_runtime,candidate_accounts}')='array'
      THEN pg_catalog.jsonb_array_length(j#>'{admin_runtime,candidate_accounts}')=1 ELSE false END
    AS valid
  FROM cfg
),
expected_tables(name) AS (
  VALUES ('organizations'),('user_profiles'),('user_invites'),
    ('client_memberships'),('candidate_accounts'),('access_audit_logs'),
    ('staging_auth_bootstrap_provenance')
),
expected_columns(table_name,column_name,udt_name,is_nullable,default_rule) AS (
  VALUES
    ('organizations','id','uuid','NO','uuid'),
    ('organizations','name','text','NO','none'),
    ('organizations','organization_type','text','NO','none'),
    ('organizations','status','text','NO','active'),
    ('organizations','created_at','timestamptz','NO','now'),
    ('organizations','updated_at','timestamptz','NO','now'),
    ('user_profiles','id','uuid','NO','uuid'),
    ('user_profiles','auth_user_id','uuid','NO','none'),
    ('user_profiles','email','text','NO','none'),
    ('user_profiles','full_name','text','YES','none'),
    ('user_profiles','role','text','NO','none'),
    ('user_profiles','status','text','NO','invited'),
    ('user_profiles','organization_id','uuid','YES','none'),
    ('user_profiles','client_id','uuid','YES','none'),
    ('user_profiles','candidate_id','uuid','YES','none'),
    ('user_profiles','created_at','timestamptz','NO','now'),
    ('user_profiles','updated_at','timestamptz','NO','now'),
    ('user_invites','id','uuid','NO','uuid'),
    ('user_invites','email','text','NO','none'),
    ('user_invites','invited_role','text','NO','none'),
    ('user_invites','organization_id','uuid','YES','none'),
    ('user_invites','client_id','uuid','YES','none'),
    ('user_invites','candidate_id','uuid','YES','none'),
    ('user_invites','status','text','NO','pending'),
    ('user_invites','expires_at','timestamptz','NO','seven_days'),
    ('user_invites','accepted_at','timestamptz','YES','none'),
    ('user_invites','created_at','timestamptz','NO','now'),
    ('user_invites','updated_at','timestamptz','NO','now'),
    ('client_memberships','id','uuid','NO','uuid'),
    ('client_memberships','user_profile_id','uuid','NO','none'),
    ('client_memberships','organization_id','uuid','NO','none'),
    ('client_memberships','client_id','uuid','NO','none'),
    ('client_memberships','status','text','NO','active'),
    ('client_memberships','created_at','timestamptz','NO','now'),
    ('client_memberships','updated_at','timestamptz','NO','now'),
    ('candidate_accounts','id','uuid','NO','uuid'),
    ('candidate_accounts','user_profile_id','uuid','NO','none'),
    ('candidate_accounts','candidate_id','uuid','NO','none'),
    ('candidate_accounts','status','text','NO','active'),
    ('candidate_accounts','created_at','timestamptz','NO','now'),
    ('candidate_accounts','updated_at','timestamptz','NO','now'),
    ('access_audit_logs','id','uuid','NO','uuid'),
    ('access_audit_logs','actor_profile_id','uuid','YES','none'),
    ('access_audit_logs','action','text','NO','none'),
    ('access_audit_logs','resource_type','text','NO','none'),
    ('access_audit_logs','resource_id','text','YES','none'),
    ('access_audit_logs','result','text','NO','none'),
    ('access_audit_logs','safe_metadata','jsonb','NO','json_object'),
    ('access_audit_logs','created_at','timestamptz','NO','now'),
    ('staging_auth_bootstrap_provenance','id','uuid','NO','none'),
    ('staging_auth_bootstrap_provenance','bootstrap_reference','text','NO','none'),
    ('staging_auth_bootstrap_provenance','organization_id','uuid','NO','none'),
    ('staging_auth_bootstrap_provenance','admin_profile_id','uuid','NO','none'),
    ('staging_auth_bootstrap_provenance','auth_user_id','uuid','NO','none'),
    ('staging_auth_bootstrap_provenance','normalized_admin_email','text','NO','none'),
    ('staging_auth_bootstrap_provenance','bootstrap_type','text','NO','none'),
    ('staging_auth_bootstrap_provenance','created_at','timestamptz','NO','now')
),
actual_columns AS (
  SELECT table_name,column_name,udt_name,is_nullable,column_default
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name IN (SELECT name FROM expected_tables)
),
column_check AS (
  SELECT
    count(*)=(SELECT count(*) FROM expected_columns)
    AND pg_catalog.bool_and(
      a.udt_name=e.udt_name
      AND a.is_nullable=e.is_nullable
      AND CASE e.default_rule
        WHEN 'none' THEN a.column_default IS NULL
        WHEN 'uuid' THEN a.column_default ILIKE '%gen_random_uuid%'
        WHEN 'now' THEN a.column_default ILIKE '%now()%'
        WHEN 'active' THEN a.column_default ILIKE '%active%'
        WHEN 'invited' THEN a.column_default ILIKE '%invited%'
        WHEN 'pending' THEN a.column_default ILIKE '%pending%'
        WHEN 'seven_days' THEN a.column_default ILIKE '%7 days%'
        WHEN 'json_object' THEN a.column_default ILIKE '%{}%'
        ELSE false END
    )
    AND NOT EXISTS (
      SELECT table_name,column_name FROM actual_columns
      EXCEPT SELECT table_name,column_name FROM expected_columns
    ) AS valid
  FROM expected_columns e
  JOIN actual_columns a USING(table_name,column_name)
),
expected_constraints(name) AS (
  VALUES
    ('organizations_pkey'),
    ('organizations_name_not_blank'),
    ('organizations_type_check'),
    ('organizations_status_check'),
    ('user_profiles_pkey'),
    ('user_profiles_email_not_blank'),
    ('user_profiles_role_check'),
    ('user_profiles_status_check'),
    ('user_profiles_auth_user_id_fkey'),
    ('user_profiles_organization_id_fkey'),
    ('user_profiles_auth_user_id_key'),
    ('user_profiles_role_ownership_shape_check'),
    ('user_invites_pkey'),
    ('user_invites_email_not_blank'),
    ('user_invites_role_check'),
    ('user_invites_status_check'),
    ('user_invites_organization_id_fkey'),
    ('user_invites_expiry_after_creation_check'),
    ('client_memberships_pkey'),
    ('client_memberships_status_check'),
    ('client_memberships_user_profile_id_fkey'),
    ('client_memberships_organization_id_fkey'),
    ('client_memberships_unique'),
    ('candidate_accounts_pkey'),
    ('candidate_accounts_status_check'),
    ('candidate_accounts_user_profile_id_fkey'),
    ('candidate_accounts_user_profile_id_key'),
    ('candidate_accounts_candidate_id_key'),
    ('access_audit_logs_pkey'),
    ('access_audit_logs_action_not_blank'),
    ('access_audit_logs_resource_type_not_blank'),
    ('access_audit_logs_result_check'),
    ('access_audit_logs_actor_profile_id_fkey'),
    ('access_audit_logs_safe_metadata_object'),
    ('staging_auth_bootstrap_provenance_pkey'),
    ('staging_auth_bootstrap_reference_not_blank'),
    ('staging_auth_bootstrap_email_not_blank'),
    ('staging_auth_bootstrap_type_check'),
    ('staging_auth_bootstrap_reference_key'),
    ('staging_auth_bootstrap_organization_id_key'),
    ('staging_auth_bootstrap_admin_profile_id_key'),
    ('staging_auth_bootstrap_auth_user_id_key'),
    ('staging_auth_bootstrap_type_key'),
    ('staging_auth_bootstrap_organization_fkey'),
    ('staging_auth_bootstrap_admin_profile_fkey'),
    ('staging_auth_bootstrap_auth_user_fkey')
),
expected_foreign_keys(name,definition) AS (
  VALUES
    ('user_profiles_auth_user_id_fkey','FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT'),
    ('user_profiles_organization_id_fkey','FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT'),
    ('user_invites_organization_id_fkey','FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT'),
    ('client_memberships_user_profile_id_fkey','FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT'),
    ('client_memberships_organization_id_fkey','FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT'),
    ('candidate_accounts_user_profile_id_fkey','FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT'),
    ('access_audit_logs_actor_profile_id_fkey','FOREIGN KEY (actor_profile_id) REFERENCES user_profiles(id) ON DELETE SET NULL'),
    ('staging_auth_bootstrap_organization_fkey','FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT'),
    ('staging_auth_bootstrap_admin_profile_fkey','FOREIGN KEY (admin_profile_id) REFERENCES user_profiles(id) ON DELETE RESTRICT'),
    ('staging_auth_bootstrap_auth_user_fkey','FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT')
),
constraint_check AS (
  SELECT
    NOT EXISTS (
      SELECT name FROM expected_constraints
      EXCEPT
      SELECT c.conname
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='public'
    )
    AND NOT EXISTS (
      SELECT c.conname
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_class r ON r.oid=c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace
      WHERE n.nspname='public'
        AND r.relname IN(SELECT name FROM expected_tables)
      EXCEPT SELECT name FROM expected_constraints
    )
    AND NOT EXISTS (
      SELECT 1
      FROM expected_foreign_keys e
      LEFT JOIN pg_catalog.pg_constraint c ON c.conname=e.name
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname IS DISTINCT FROM 'public'
         OR pg_catalog.pg_get_constraintdef(c.oid) IS DISTINCT FROM e.definition
    )
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='organizations_type_check')
      ~ 'internal.*client.*candidate.*partner'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='organizations_status_check')
      ~ 'active.*inactive.*suspended.*disabled'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='user_profiles_role_check')
      ~ 'admin.*recruiter_manager.*recruiter.*client.*candidate.*guest'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='user_profiles_status_check')
      ~ 'invited.*active.*inactive.*suspended.*disabled'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='user_profiles_role_ownership_shape_check')
      ~ 'organization_id.*client_id.*candidate_id'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='user_invites_role_check')
      ~ 'admin.*recruiter_manager.*recruiter.*client.*candidate'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='user_invites_status_check')
      ~ 'pending.*accepted.*expired.*revoked'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='user_invites_expiry_after_creation_check')
      ~ 'expires_at.*created_at'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='client_memberships_status_check')
      ~ 'active.*inactive.*suspended.*disabled'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='candidate_accounts_status_check')
      ~ 'active.*inactive.*suspended.*disabled'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='access_audit_logs_result_check')
      ~ 'allowed.*denied.*blocked.*failed_safe'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='access_audit_logs_safe_metadata_object')
      ~ 'jsonb_typeof.*object'
    AND (SELECT pg_catalog.pg_get_constraintdef(c.oid)
      FROM pg_catalog.pg_constraint c
      WHERE c.conname='staging_auth_bootstrap_type_check')
      ~ 'initial_owner'
    AS valid
),
index_check AS (
  SELECT
    pg_catalog.to_regclass('public.user_profiles_email_normalized_uidx') IS NOT NULL
    AND pg_catalog.pg_get_indexdef(
      pg_catalog.to_regclass('public.user_profiles_email_normalized_uidx')
    ) ~ 'UNIQUE.*lower\(btrim\(email\)\)'
    AND pg_catalog.to_regclass(
      'public.user_invites_one_pending_per_email_uidx'
    ) IS NOT NULL
    AND pg_catalog.pg_get_indexdef(
      pg_catalog.to_regclass('public.user_invites_one_pending_per_email_uidx')
    ) ~ 'UNIQUE.*lower\(btrim\(email\)\).*WHERE.*status.*pending'
    AS valid
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
  SELECT policyname AS name,tablename AS table_name,cmd AS command,roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename IN (SELECT name FROM expected_tables)
),
policy_check AS (
  SELECT
    count(*)=30
    AND NOT EXISTS (
      SELECT name,table_name,command FROM expected_policies
      EXCEPT SELECT name,table_name,command FROM actual_policies
    )
    AND NOT EXISTS (
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
    AND p.proname IN (SELECT name FROM expected_functions)
),
function_check AS (
  SELECT
    count(*)=9
    AND NOT EXISTS (
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
    AND pg_catalog.bool_and(NOT EXISTS (
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
  SELECT t.tgname AS name
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D'
    AND c.relname IN (SELECT name FROM expected_tables)
),
trigger_check AS (
  SELECT
    (SELECT count(*) FROM actual_triggers)=8
    AND NOT EXISTS (
      SELECT name FROM expected_triggers
      EXCEPT SELECT name FROM actual_triggers
    )
    AND NOT EXISTS (
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
        name IN ('organizations','user_profiles','user_invites',
          'client_memberships','candidate_accounts')
      )
    )
    AND (
      pg_catalog.has_table_privilege(
        'authenticated',pg_catalog.format('public.%I',name),'UPDATE'
      ) = (
        name IN ('organizations','user_profiles','user_invites',
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
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))
      ) x
      WHERE n.nspname='public' AND c.relname=name AND x.grantee=0
        AND x.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
    )
  ) AS valid
  FROM expected_tables
),
primary_id_texts(kind,id_text) AS (
  SELECT 'setup_org',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,organizations}') x
  UNION ALL SELECT 'setup_profile',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') x
  UNION ALL SELECT 'setup_membership',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,memberships}') x
  UNION ALL SELECT 'setup_account',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,candidate_accounts}') x
  UNION ALL SELECT 'admin_org',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,organizations}') x
  UNION ALL SELECT 'admin_profile',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,profiles}') x
  UNION ALL SELECT 'admin_invite',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,invites}') x
  UNION ALL SELECT 'admin_membership',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,memberships}') x
  UNION ALL SELECT 'admin_account',x->>'id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,candidate_accounts}') x
  UNION ALL
  SELECT 'attempt_org',d.value#>>'{organization,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT 'attempt_profile',d.value#>>'{profile,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT 'attempt_invite',d.value#>>'{invite,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT 'attempt_membership',d.value#>>'{membership,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT 'attempt_account',d.value#>>'{candidate_account,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT 'attempt_audit',d.value#>>'{audit,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'immutable_attempts') d
  UNION ALL SELECT 'attempt_provenance',d.value#>>'{provenance,id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'immutable_attempts') d
),
primary_ids AS (
  SELECT kind,
    CASE WHEN pg_catalog.pg_input_is_valid(id_text,'uuid')
      THEN id_text::uuid ELSE NULL END AS id
  FROM primary_id_texts
),
auth_id_texts AS (
  SELECT value->>'auth_user_id' AS id_text
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'auth_users')
),
auth_ids AS (
  SELECT CASE WHEN pg_catalog.pg_input_is_valid(id_text,'uuid')
    THEN id_text::uuid ELSE NULL END AS id
  FROM auth_id_texts
),
opaque_id_texts AS (
  SELECT x->>'client_id' id_text
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') x
  WHERE x->'client_id'<>'null'::jsonb
  UNION ALL SELECT x->>'candidate_id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') x
  WHERE x->'candidate_id'<>'null'::jsonb
  UNION ALL SELECT x->>'client_id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,profiles}') x
  WHERE x->'client_id'<>'null'::jsonb
  UNION ALL SELECT x->>'candidate_id'
  FROM cfg,pg_catalog.jsonb_array_elements(j#>'{admin_runtime,profiles}') x
  WHERE x->'candidate_id'<>'null'::jsonb
  UNION ALL SELECT d.value#>>'{membership,client_id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
  UNION ALL SELECT d.value#>>'{candidate_account,candidate_id}'
  FROM cfg,LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
),
opaque_ids AS (
  SELECT CASE WHEN pg_catalog.pg_input_is_valid(id_text,'uuid')
    THEN id_text::uuid ELSE NULL END AS id
  FROM opaque_id_texts
),
config_relationship_check AS (
  SELECT
    NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(j#>'{setup,organizations}') x
      WHERE x->>'creation_stage'<>'setup'
        OR x->>'organization_type' NOT IN('internal','client')
        OR x->>'status'<>'active'
        OR pg_catalog.btrim(x->>'name')=''
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') x
      WHERE x->>'creation_stage'<>'setup'
        OR x->>'role' NOT IN(
          'admin','recruiter_manager','recruiter','client','candidate'
        )
        OR x->>'status' NOT IN('active','invited')
    )
    AND (
      SELECT count(*)
      FROM pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') p
      JOIN LATERAL pg_catalog.jsonb_each(j->'auth_users') a
        ON (a.value->>'auth_user_id')::uuid=(p->>'auth_user_id')::uuid
       AND pg_catalog.lower(pg_catalog.btrim(a.value->>'email'))
         =pg_catalog.lower(pg_catalog.btrim(p->>'email'))
    )=6
    AND (
      SELECT count(*)
      FROM pg_catalog.jsonb_array_elements(j#>'{setup,memberships}') m
      JOIN pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') p
        ON (p->>'id')::uuid=(m->>'user_profile_id')::uuid
       AND p->>'role'='client' AND p->>'status'='active'
       AND (p->>'organization_id')::uuid=(m->>'organization_id')::uuid
       AND (p->>'client_id')::uuid=(m->>'client_id')::uuid
    )=1
    AND (
      SELECT count(*)
      FROM pg_catalog.jsonb_array_elements(j#>'{setup,candidate_accounts}') a
      JOIN pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') p
        ON (p->>'id')::uuid=(a->>'user_profile_id')::uuid
       AND p->>'role'='candidate' AND p->>'status'='active'
       AND (p->>'candidate_id')::uuid=(a->>'candidate_id')::uuid
    )=1
    AND (
      SELECT count(*)
      FROM pg_catalog.jsonb_array_elements(j#>'{admin_runtime,profiles}') p
      JOIN LATERAL pg_catalog.jsonb_each(j->'auth_users') a
        ON a.key='inactive_candidate'
       AND (a.value->>'auth_user_id')::uuid=(p->>'auth_user_id')::uuid
       AND pg_catalog.lower(pg_catalog.btrim(a.value->>'email'))
         =pg_catalog.lower(pg_catalog.btrim(p->>'email'))
       AND p->>'role'='candidate' AND p->>'status'='inactive'
       AND p->>'creation_stage'='admin_runtime'
    )=1
    AND (
      SELECT count(*)
      FROM pg_catalog.jsonb_array_elements(j#>'{admin_runtime,memberships}') m
      JOIN pg_catalog.jsonb_array_elements(j#>'{setup,profiles}') p
        ON (p->>'id')::uuid=(m->>'user_profile_id')::uuid
       AND p->>'logical_reference'='RLSV4-P5-V6-PROFILE-INVITED-CLIENT'
       AND (p->>'organization_id')::uuid=(m->>'organization_id')::uuid
       AND (p->>'client_id')::uuid=(m->>'client_id')::uuid
    )=1
    AND (
      SELECT count(*)
      FROM pg_catalog.jsonb_array_elements(
        j#>'{admin_runtime,candidate_accounts}'
      ) a
      JOIN pg_catalog.jsonb_array_elements(j#>'{admin_runtime,profiles}') p
        ON (p->>'id')::uuid=(a->>'user_profile_id')::uuid
       AND (p->>'candidate_id')::uuid=(a->>'candidate_id')::uuid
    )=1
    AND NOT EXISTS (
      SELECT 1
      FROM LATERAL pg_catalog.jsonb_each(j->'denied_attempts') d
      WHERE d.value#>>'{organization,creation_stage}'<>'runtime_denied'
         OR d.value#>>'{profile,creation_stage}'<>'runtime_denied'
         OR d.value#>>'{invite,creation_stage}'<>'runtime_denied'
         OR d.value#>>'{membership,creation_stage}'<>'runtime_denied'
         OR d.value#>>'{candidate_account,creation_stage}'<>'runtime_denied'
         OR d.value#>>'{profile,role}'<>'guest'
         OR d.value#>>'{profile,status}'<>'invited'
         OR d.value#>>'{invite,invited_role}'<>'client'
         OR d.value#>>'{invite,status}'<>'pending'
         OR d.value#>>'{membership,status}'<>'active'
         OR d.value#>>'{candidate_account,status}'<>'active'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM LATERAL pg_catalog.jsonb_each(j->'immutable_attempts') d
      WHERE d.value#>>'{audit,result}' NOT IN(
        'allowed','denied','blocked','failed_safe'
      )
         OR d.value#>>'{provenance,bootstrap_type}'<>'initial_owner'
         OR (d.value#>>'{provenance,organization_id}')::uuid
            <>(j#>>'{existing_foundation,organization_id}')::uuid
         OR (d.value#>>'{provenance,admin_profile_id}')::uuid
            <>(j#>>'{existing_foundation,profile_id}')::uuid
         OR (d.value#>>'{provenance,auth_user_id}')::uuid
            <>(j#>>'{existing_foundation,auth_user_id}')::uuid
    )
    AS valid
  FROM cfg
),
configured_foundation AS (
  SELECT
    CASE WHEN pg_catalog.pg_input_is_valid(
      j#>>'{existing_foundation,organization_id}','uuid'
    ) THEN (j#>>'{existing_foundation,organization_id}')::uuid END AS organization_id,
    CASE WHEN pg_catalog.pg_input_is_valid(
      j#>>'{existing_foundation,profile_id}','uuid'
    ) THEN (j#>>'{existing_foundation,profile_id}')::uuid END AS profile_id,
    CASE WHEN pg_catalog.pg_input_is_valid(
      j#>>'{existing_foundation,auth_user_id}','uuid'
    ) THEN (j#>>'{existing_foundation,auth_user_id}')::uuid END AS auth_user_id,
    CASE WHEN pg_catalog.pg_input_is_valid(
      j#>>'{existing_foundation,provenance_id}','uuid'
    ) THEN (j#>>'{existing_foundation,provenance_id}')::uuid END AS provenance_id
  FROM cfg
),
id_check AS (
  SELECT
    (SELECT count(*) FROM primary_ids)=74
    AND (SELECT count(*) FROM primary_ids WHERE id IS NULL)=0
    AND (SELECT count(DISTINCT id) FROM primary_ids)=74
    AND (SELECT count(*) FROM auth_ids)=8
    AND (SELECT count(*) FROM auth_ids WHERE id IS NULL)=0
    AND (SELECT count(DISTINCT id) FROM auth_ids)=8
    AND (SELECT count(*) FROM opaque_ids)=20
    AND (SELECT count(*) FROM opaque_ids WHERE id IS NULL)=0
    AND (SELECT count(DISTINCT id) FROM opaque_ids)=20
    AND NOT EXISTS (
      SELECT 1 FROM primary_ids p JOIN auth_ids a ON p.id=a.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM primary_ids p,configured_foundation f
      WHERE p.id IN(f.organization_id,f.profile_id,f.auth_user_id,f.provenance_id)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM auth_ids a,configured_foundation f
      WHERE a.id IN(f.organization_id,f.profile_id,f.auth_user_id,f.provenance_id)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM opaque_ids o,configured_foundation f
      WHERE o.id IN(f.organization_id,f.profile_id,f.auth_user_id,f.provenance_id)
    )
    AS valid
),
configured_ids_absent AS (
  SELECT
    NOT EXISTS (
      SELECT 1 FROM public.organizations WHERE id IN(SELECT id FROM primary_ids)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles WHERE id IN(SELECT id FROM primary_ids)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_invites WHERE id IN(SELECT id FROM primary_ids)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.client_memberships WHERE id IN(SELECT id FROM primary_ids)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.candidate_accounts WHERE id IN(SELECT id FROM primary_ids)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.access_audit_logs WHERE id IN(SELECT id FROM primary_ids)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.staging_auth_bootstrap_provenance
      WHERE id IN(SELECT id FROM primary_ids)
    )
    AS valid
),
auth_inventory AS (
  SELECT
    (SELECT count(*) FROM auth.users u JOIN auth_ids a ON a.id=u.id)=8
    AND NOT EXISTS (
      SELECT 1
      FROM cfg
      CROSS JOIN LATERAL pg_catalog.jsonb_each(j->'auth_users') a
      LEFT JOIN auth.users u
        ON u.id=(a.value->>'auth_user_id')::uuid
      WHERE u.id IS NULL
         OR pg_catalog.lower(pg_catalog.btrim(u.email))
            <>pg_catalog.lower(pg_catalog.btrim(a.value->>'email'))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles p JOIN auth_ids a ON a.id=p.auth_user_id
    )
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
      FROM configured_foundation f
      JOIN public.staging_auth_bootstrap_provenance b ON b.id=f.provenance_id
      JOIN public.organizations o
        ON o.id=f.organization_id AND o.id=b.organization_id
      JOIN public.user_profiles p
        ON p.id=f.profile_id AND p.id=b.admin_profile_id
      JOIN auth.users u
        ON u.id=f.auth_user_id AND u.id=b.auth_user_id
      WHERE b.bootstrap_type='initial_owner'
        AND o.organization_type='internal' AND o.status='active'
        AND p.auth_user_id=f.auth_user_id
        AND p.organization_id=f.organization_id
        AND p.role='admin' AND p.status='active'
        AND p.client_id IS NULL AND p.candidate_id IS NULL
        AND pg_catalog.lower(pg_catalog.btrim(p.email))
          =b.normalized_admin_email
        AND pg_catalog.lower(pg_catalog.btrim(u.email))
          =b.normalized_admin_email
    )
    AS valid
),
structural_check AS (
  SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND c.relname IN(SELECT name FROM expected_tables))=7 AS tables_ok,
    (SELECT count(*) FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
        AND c.relname IN(SELECT name FROM expected_tables)
        AND c.relrowsecurity)=7 AS rls_ok,
    (SELECT count(*) FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
        AND c.relname IN(SELECT name FROM expected_tables)
        AND c.relforcerowsecurity)=7 AS force_ok
),
checks AS (
  SELECT
    current_user='postgres' AS execution_role_is_postgres,
    (SELECT valid FROM config_shape) AS config_shape_valid,
    (SELECT valid FROM column_check) AS columns_valid,
    (SELECT valid FROM constraint_check) AS constraints_valid,
    (SELECT valid FROM index_check) AS indexes_valid,
    (SELECT valid FROM policy_check) AS policies_valid,
    (SELECT valid FROM function_check) AS functions_valid,
    (SELECT valid FROM trigger_check) AS triggers_valid,
    (SELECT valid FROM acl_check) AS acl_valid,
    (SELECT valid FROM id_check) AS identifiers_valid,
    (SELECT valid FROM config_relationship_check)
      AS configured_relationships_valid,
    (SELECT valid FROM configured_ids_absent) AS fixture_ids_absent,
    (SELECT valid FROM auth_inventory) AS auth_inventory_valid,
    (SELECT valid FROM foundation_check) AS existing_foundation_exact,
    (SELECT tables_ok AND rls_ok AND force_ok FROM structural_check)
      AS rls_structure_valid
)
SELECT
  *,
  (SELECT pg_catalog.bool_and(value::boolean)
   FROM LATERAL pg_catalog.jsonb_each_text(
     pg_catalog.to_jsonb(checks)
   ) item(key,value)) AS pre_runtime_ready
FROM checks;

ROLLBACK;

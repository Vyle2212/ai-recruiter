-- PHASE 5 V6 NORMAL PUBLIC FIXTURE CLEANUP
-- MUTATION. USE ONLY AFTER COMPLETE RUNTIME INSERT STAGE.
BEGIN;

DO $phase5_v6_cleanup$
DECLARE
  config_b64 constant text := '__STAGING_PHASE5_FIXTURE_CONFIG_B64__';
  c jsonb;
  affected integer;
  mismatch boolean;
  foundation_organization_id uuid;
  foundation_profile_id uuid;
  foundation_auth_user_id uuid;
  foundation_provenance_id uuid;
  expected_policies constant text[] := ARRAY['staging_auth_v4_admin_organizations_select','staging_auth_v4_admin_organizations_insert','staging_auth_v4_admin_organizations_update','staging_auth_v4_admin_user_profiles_select','staging_auth_v4_admin_user_profiles_insert','staging_auth_v4_admin_user_profiles_update','staging_auth_v4_admin_user_invites_select','staging_auth_v4_admin_user_invites_insert','staging_auth_v4_admin_user_invites_update','staging_auth_v4_admin_client_memberships_select','staging_auth_v4_admin_client_memberships_insert','staging_auth_v4_admin_client_memberships_update','staging_auth_v4_admin_candidate_accounts_select','staging_auth_v4_admin_candidate_accounts_insert','staging_auth_v4_admin_candidate_accounts_update','staging_auth_v4_admin_access_audit_logs_select','staging_auth_v4_admin_bootstrap_provenance_select','staging_auth_v4_recruiter_manager_organizations_select','staging_auth_v4_recruiter_manager_user_profiles_self_select','staging_auth_v4_recruiter_manager_user_profiles_self_update','staging_auth_v4_recruiter_organizations_select','staging_auth_v4_recruiter_user_profiles_select','staging_auth_v4_recruiter_user_profiles_update','staging_auth_v4_client_organizations_select','staging_auth_v4_client_user_profiles_select','staging_auth_v4_client_user_profiles_update','staging_auth_v4_client_client_memberships_select','staging_auth_v4_candidate_user_profiles_select','staging_auth_v4_candidate_user_profiles_update','staging_auth_v4_candidate_candidate_accounts_select'];
  expected_triggers constant text[] := ARRAY['organizations_set_updated_at','user_profiles_set_updated_at','user_profiles_guard_protected','user_invites_set_updated_at','client_memberships_set_updated_at','candidate_accounts_set_updated_at','access_audit_logs_reject_update','access_audit_logs_reject_delete'];
BEGIN
  IF current_user<>'postgres' THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_context_invalid';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(731942607310019);

  BEGIN
    c:=pg_catalog.convert_from(
      pg_catalog.decode(config_b64,'base64'),'UTF8'
    )::jsonb;
    foundation_organization_id :=
      (c#>>'{existing_foundation,organization_id}')::uuid;
    foundation_profile_id :=
      (c#>>'{existing_foundation,profile_id}')::uuid;
    foundation_auth_user_id :=
      (c#>>'{existing_foundation,auth_user_id}')::uuid;
    foundation_provenance_id :=
      (c#>>'{existing_foundation,provenance_id}')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_config_invalid';
  END;

  IF pg_catalog.jsonb_typeof(c)<>'object'
    OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(c))<>8
    OR EXISTS(
      SELECT key FROM pg_catalog.jsonb_object_keys(c) supplied(key)
      WHERE key<>ALL(ARRAY[
        'config_version','batch_reference','existing_foundation','auth_users',
        'setup','admin_runtime','denied_attempts','immutable_attempts'
      ])
    )
    OR EXISTS(
      SELECT required FROM unnest(ARRAY[
        'config_version','batch_reference','existing_foundation','auth_users',
        'setup','admin_runtime','denied_attempts','immutable_attempts'
      ]) required WHERE NOT c ? required
    )
    OR c->>'config_version'<>'phase5-fixtures-v6'
    OR pg_catalog.jsonb_array_length(c#>'{setup,organizations}')<>3
    OR pg_catalog.jsonb_array_length(c#>'{setup,profiles}')<>6
    OR pg_catalog.jsonb_array_length(c#>'{setup,memberships}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{setup,candidate_accounts}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,organizations}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,profiles}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,invites}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,memberships}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,candidate_accounts}')<>1
  THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_config_shape_invalid';
  END IF;

  IF (
    SELECT count(*)<>1
    FROM public.staging_auth_bootstrap_provenance b
    JOIN public.organizations o ON o.id=b.organization_id
    JOIN public.user_profiles p ON p.id=b.admin_profile_id
    JOIN auth.users u ON u.id=b.auth_user_id
    WHERE b.id=foundation_provenance_id
      AND b.organization_id=foundation_organization_id
      AND b.admin_profile_id=foundation_profile_id
      AND b.auth_user_id=foundation_auth_user_id
      AND b.bootstrap_type='initial_owner'
      AND o.organization_type='internal' AND o.status='active'
      AND p.role='admin' AND p.status='active'
      AND p.auth_user_id=foundation_auth_user_id
      AND p.organization_id=foundation_organization_id
      AND p.client_id IS NULL AND p.candidate_id IS NULL
      AND pg_catalog.lower(pg_catalog.btrim(p.email))=b.normalized_admin_email
      AND pg_catalog.lower(pg_catalog.btrim(u.email))=b.normalized_admin_email
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_foundation_invalid';
  END IF;

  IF (SELECT count(*) FROM public.organizations)<>5
    OR (SELECT count(*) FROM public.user_profiles)<>8
    OR (SELECT count(*) FROM public.user_invites)<>1
    OR (SELECT count(*) FROM public.client_memberships)<>2
    OR (SELECT count(*) FROM public.candidate_accounts)<>2
    OR (SELECT count(*) FROM public.access_audit_logs)<>0
    OR (SELECT count(*) FROM public.staging_auth_bootstrap_provenance)<>1
  THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_total_count_invalid';
  END IF;

  SELECT
    (SELECT count(*)
     FROM public.organizations o
     JOIN pg_catalog.jsonb_array_elements(
       (c#>'{setup,organizations}') || (c#>'{admin_runtime,organizations}')
     ) x
       ON o.id=(x->>'id')::uuid
      AND o.name=x->>'name'
      AND o.organization_type=x->>'organization_type'
      AND o.status=x->>'status'
      AND x->>'creation_stage' IN('setup','admin_runtime'))<>4
    OR
    (SELECT count(*)
     FROM public.user_profiles p
     JOIN pg_catalog.jsonb_array_elements(
       (c#>'{setup,profiles}') || (c#>'{admin_runtime,profiles}')
     ) x
       ON p.id=(x->>'id')::uuid
      AND p.auth_user_id=(x->>'auth_user_id')::uuid
      AND pg_catalog.lower(pg_catalog.btrim(p.email))
        =pg_catalog.lower(pg_catalog.btrim(x->>'email'))
      AND p.full_name IS NOT DISTINCT FROM x->>'full_name'
      AND p.role=x->>'role' AND p.status=x->>'status'
      AND p.organization_id IS NOT DISTINCT FROM
        CASE WHEN x->'organization_id'='null'::jsonb
          THEN NULL ELSE (x->>'organization_id')::uuid END
      AND p.client_id IS NOT DISTINCT FROM
        CASE WHEN x->'client_id'='null'::jsonb
          THEN NULL ELSE (x->>'client_id')::uuid END
      AND p.candidate_id IS NOT DISTINCT FROM
        CASE WHEN x->'candidate_id'='null'::jsonb
          THEN NULL ELSE (x->>'candidate_id')::uuid END
      AND x->>'creation_stage' IN('setup','admin_runtime'))<>7
    OR
    (SELECT count(*)
     FROM public.user_invites i
     JOIN pg_catalog.jsonb_array_elements(c#>'{admin_runtime,invites}') x
       ON i.id=(x->>'id')::uuid
      AND pg_catalog.lower(pg_catalog.btrim(i.email))
        =pg_catalog.lower(pg_catalog.btrim(x->>'email'))
      AND i.invited_role=x->>'invited_role'
      AND i.organization_id IS NOT DISTINCT FROM
        CASE WHEN x->'organization_id'='null'::jsonb
          THEN NULL ELSE (x->>'organization_id')::uuid END
      AND i.client_id IS NOT DISTINCT FROM
        CASE WHEN x->'client_id'='null'::jsonb
          THEN NULL ELSE (x->>'client_id')::uuid END
      AND i.candidate_id IS NOT DISTINCT FROM
        CASE WHEN x->'candidate_id'='null'::jsonb
          THEN NULL ELSE (x->>'candidate_id')::uuid END
      AND i.status=x->>'status'
      AND x->>'creation_stage'='admin_runtime')<>1
    OR
    (SELECT count(*)
     FROM public.client_memberships m
     JOIN pg_catalog.jsonb_array_elements(
       (c#>'{setup,memberships}') || (c#>'{admin_runtime,memberships}')
     ) x
       ON m.id=(x->>'id')::uuid
      AND m.user_profile_id=(x->>'user_profile_id')::uuid
      AND m.organization_id=(x->>'organization_id')::uuid
      AND m.client_id=(x->>'client_id')::uuid
      AND m.status=x->>'status'
      AND x->>'creation_stage' IN('setup','admin_runtime'))<>2
    OR
    (SELECT count(*)
     FROM public.candidate_accounts a
     JOIN pg_catalog.jsonb_array_elements(
       (c#>'{setup,candidate_accounts}') || (c#>'{admin_runtime,candidate_accounts}')
     ) x
       ON a.id=(x->>'id')::uuid
      AND a.user_profile_id=(x->>'user_profile_id')::uuid
      AND a.candidate_id=(x->>'candidate_id')::uuid
      AND a.status=x->>'status'
      AND x->>'creation_stage' IN('setup','admin_runtime'))<>2
  INTO mismatch;

  IF mismatch THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_exact_match_failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    JOIN public.organizations o
      ON o.id=(d.value#>>'{organization,id}')::uuid
  ) OR EXISTS (
    SELECT 1
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    JOIN public.user_profiles p
      ON p.id=(d.value#>>'{profile,id}')::uuid
  ) OR EXISTS (
    SELECT 1
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    JOIN public.user_invites i
      ON i.id=(d.value#>>'{invite,id}')::uuid
  ) OR EXISTS (
    SELECT 1
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    JOIN public.client_memberships m
      ON m.id=(d.value#>>'{membership,id}')::uuid
  ) OR EXISTS (
    SELECT 1
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    JOIN public.candidate_accounts a
      ON a.id=(d.value#>>'{candidate_account,id}')::uuid
  ) OR EXISTS (
    SELECT 1
    FROM LATERAL pg_catalog.jsonb_each(c->'immutable_attempts') d
    JOIN public.access_audit_logs a
      ON a.id=(d.value#>>'{audit,id}')::uuid
  ) OR EXISTS (
    SELECT 1
    FROM LATERAL pg_catalog.jsonb_each(c->'immutable_attempts') d
    JOIN public.staging_auth_bootstrap_provenance p
      ON p.id=(d.value#>>'{provenance,id}')::uuid
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_unexpected_attempt_row';
  END IF;

  DELETE FROM public.candidate_accounts
  WHERE id IN(
    SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(
      (c#>'{setup,candidate_accounts}') || (c#>'{admin_runtime,candidate_accounts}')
    ) x
  );
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>2 THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_candidate_account_count_invalid';
  END IF;

  DELETE FROM public.client_memberships
  WHERE id IN(
    SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(
      (c#>'{setup,memberships}') || (c#>'{admin_runtime,memberships}')
    ) x
  );
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>2 THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_membership_count_invalid';
  END IF;

  DELETE FROM public.user_invites
  WHERE id IN(
    SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,invites}') x
  );
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_invite_count_invalid';
  END IF;

  DELETE FROM public.user_profiles
  WHERE id IN(
    SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(
      (c#>'{setup,profiles}') || (c#>'{admin_runtime,profiles}')
    ) x
  );
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>7 THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_profile_count_invalid';
  END IF;

  DELETE FROM public.organizations
  WHERE id IN(
    SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(
      (c#>'{setup,organizations}') || (c#>'{admin_runtime,organizations}')
    ) x
  );
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>4 THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_organization_count_invalid';
  END IF;

  IF (SELECT count(*) FROM public.organizations)<>1
    OR (SELECT count(*) FROM public.user_profiles)<>1
    OR (SELECT count(*) FROM public.user_invites)<>0
    OR (SELECT count(*) FROM public.client_memberships)<>0
    OR (SELECT count(*) FROM public.candidate_accounts)<>0
    OR (SELECT count(*) FROM public.access_audit_logs)<>0
    OR (SELECT count(*) FROM public.staging_auth_bootstrap_provenance)<>1
    OR (
      SELECT count(*)<>1
      FROM public.staging_auth_bootstrap_provenance b
      JOIN public.organizations o ON o.id=b.organization_id
      JOIN public.user_profiles p ON p.id=b.admin_profile_id
      JOIN auth.users u ON u.id=b.auth_user_id
      WHERE b.id=foundation_provenance_id
        AND o.id=foundation_organization_id
        AND p.id=foundation_profile_id
        AND u.id=foundation_auth_user_id
        AND b.bootstrap_type='initial_owner'
        AND p.role='admin' AND p.status='active'
        AND p.auth_user_id=foundation_auth_user_id
        AND p.organization_id=foundation_organization_id
        AND pg_catalog.lower(pg_catalog.btrim(p.email))
          =b.normalized_admin_email
        AND pg_catalog.lower(pg_catalog.btrim(u.email))
          =b.normalized_admin_email
    )
    OR NOT (
      WITH expected(name,table_name,command) AS (
        VALUES ('staging_auth_v4_admin_organizations_select','organizations','SELECT'),
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
      actual AS (
        SELECT policyname name,tablename table_name,cmd command,roles
        FROM pg_catalog.pg_policies
        WHERE schemaname='public'
          AND tablename IN(
            'organizations','user_profiles','user_invites',
            'client_memberships','candidate_accounts','access_audit_logs',
            'staging_auth_bootstrap_provenance'
          )
      )
      SELECT count(*)=30
        AND NOT EXISTS(
          SELECT name,table_name,command FROM expected
          EXCEPT SELECT name,table_name,command FROM actual
        )
        AND NOT EXISTS(
          SELECT name,table_name,command FROM actual
          EXCEPT SELECT name,table_name,command FROM expected
        )
        AND pg_catalog.bool_and(roles=ARRAY['authenticated'::name])
      FROM actual
    )
    OR (
      SELECT count(*)<>7
      FROM pg_catalog.pg_class c2
      JOIN pg_catalog.pg_namespace n2 ON n2.oid=c2.relnamespace
      WHERE n2.nspname='public'
        AND c2.relname IN(
          'organizations','user_profiles','user_invites',
          'client_memberships','candidate_accounts','access_audit_logs',
          'staging_auth_bootstrap_provenance'
        )
        AND c2.relrowsecurity
    )
    OR (
      SELECT count(*)<>7
      FROM pg_catalog.pg_class c2
      JOIN pg_catalog.pg_namespace n2 ON n2.oid=c2.relnamespace
      WHERE n2.nspname='public'
        AND c2.relname IN(
          'organizations','user_profiles','user_invites',
          'client_memberships','candidate_accounts','access_audit_logs',
          'staging_auth_bootstrap_provenance'
        )
        AND c2.relforcerowsecurity
    )
    OR NOT (
      WITH expected(name,allowed) AS (
        VALUES ('set_staging_auth_updated_at',false),
    ('current_user_profile_id',true),
    ('current_user_role',true),
    ('current_user_organization_id',true),
    ('current_user_client_id',true),
    ('current_user_candidate_id',true),
    ('current_user_is_admin',true),
    ('guard_user_profile_protected_columns',false),
    ('reject_access_audit_log_mutation',false)
      ),
      actual AS (
        SELECT p.oid,p.proname,p.proacl,p.proowner
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.pronargs=0
          AND p.proname IN(SELECT name FROM expected)
      )
      SELECT count(*)=9
        AND pg_catalog.bool_and(
          pg_catalog.has_function_privilege(
            'authenticated',a.oid,'EXECUTE'
          )=e.allowed
        )
        AND pg_catalog.bool_and(
          NOT pg_catalog.has_function_privilege('anon',a.oid,'EXECUTE')
        )
        AND pg_catalog.bool_and(
          NOT pg_catalog.has_function_privilege(
            'service_role',a.oid,'EXECUTE'
          )
        )
        AND pg_catalog.bool_and(NOT EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(
            coalesce(a.proacl,pg_catalog.acldefault('f',a.proowner))
          ) x
          WHERE x.grantee=0 AND x.privilege_type='EXECUTE'
        ))
      FROM expected e JOIN actual a ON a.proname=e.name
    )
    OR (
      SELECT count(*)<>8
      FROM pg_catalog.pg_trigger t2
      JOIN pg_catalog.pg_class c2 ON c2.oid=t2.tgrelid
      JOIN pg_catalog.pg_namespace n2 ON n2.oid=c2.relnamespace
      WHERE n2.nspname='public' AND NOT t2.tgisinternal
        AND t2.tgenabled<>'D' AND t2.tgname=ANY(expected_triggers)
    )
    OR (
      SELECT count(*)<>8
      FROM pg_catalog.pg_trigger t3
      JOIN pg_catalog.pg_class c3 ON c3.oid=t3.tgrelid
      JOIN pg_catalog.pg_namespace n3 ON n3.oid=c3.relnamespace
      WHERE n3.nspname='public' AND NOT t3.tgisinternal
        AND t3.tgenabled<>'D'
        AND c3.relname IN(
          'organizations','user_profiles','user_invites',
          'client_memberships','candidate_accounts','access_audit_logs',
          'staging_auth_bootstrap_provenance'
        )
    )

    OR NOT (
      WITH expected(name) AS (
        VALUES ('organizations'),('user_profiles'),('user_invites'),
          ('client_memberships'),('candidate_accounts'),
          ('access_audit_logs'),('staging_auth_bootstrap_provenance')
      )
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
          )=(name IN('organizations','user_profiles','user_invites',
            'client_memberships','candidate_accounts'))
        )
        AND (
          pg_catalog.has_table_privilege(
            'authenticated',pg_catalog.format('public.%I',name),'UPDATE'
          )=(name IN('organizations','user_profiles','user_invites',
            'client_memberships','candidate_accounts'))
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
      ) FROM expected
    )
  THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_cleanup_final_verification_failed';
  END IF;
END
$phase5_v6_cleanup$;

COMMIT;

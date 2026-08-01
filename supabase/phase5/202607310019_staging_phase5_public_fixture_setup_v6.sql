-- PHASE 5 V6 PUBLIC FIXTURE SETUP
-- MUTATION. MANUAL APPROVAL REQUIRED. DEDICATED STAGING ONLY.
BEGIN;

DO $phase5_v6_setup$
DECLARE
  config_b64 constant text := '__STAGING_PHASE5_FIXTURE_CONFIG_B64__';
  c jsonb;
  affected integer;
  mismatch_count integer;
  mismatch boolean;
  foundation_organization_id uuid;
  foundation_profile_id uuid;
  foundation_auth_user_id uuid;
  foundation_provenance_id uuid;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_context_invalid';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(731942607310019);

  BEGIN
    c := pg_catalog.convert_from(
      pg_catalog.decode(config_b64,'base64'),'UTF8'
    )::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_config_invalid';
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
    OR pg_catalog.btrim(c->>'batch_reference')=''
    OR pg_catalog.jsonb_typeof(c->'existing_foundation')<>'object'
    OR pg_catalog.jsonb_typeof(c->'auth_users')<>'object'
    OR pg_catalog.jsonb_typeof(c->'setup')<>'object'
    OR pg_catalog.jsonb_typeof(c->'admin_runtime')<>'object'
    OR pg_catalog.jsonb_typeof(c->'denied_attempts')<>'object'
    OR pg_catalog.jsonb_typeof(c->'immutable_attempts')<>'object'
    OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(c->'auth_users'))<>8
    OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(c->'denied_attempts'))<>8
    OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(c->'immutable_attempts'))<>9
    OR pg_catalog.jsonb_array_length(c#>'{setup,organizations}')<>3
    OR pg_catalog.jsonb_array_length(c#>'{setup,profiles}')<>6
    OR pg_catalog.jsonb_array_length(c#>'{setup,invites}')<>0
    OR pg_catalog.jsonb_array_length(c#>'{setup,memberships}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{setup,candidate_accounts}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,organizations}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,profiles}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,invites}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,memberships}')<>1
    OR pg_catalog.jsonb_array_length(c#>'{admin_runtime,candidate_accounts}')<>1
  THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_config_shape_invalid';
  END IF;

  BEGIN
    foundation_organization_id :=
      (c#>>'{existing_foundation,organization_id}')::uuid;
    foundation_profile_id :=
      (c#>>'{existing_foundation,profile_id}')::uuid;
    foundation_auth_user_id :=
      (c#>>'{existing_foundation,auth_user_id}')::uuid;
    foundation_provenance_id :=
      (c#>>'{existing_foundation,provenance_id}')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_foundation_uuid_invalid';
  END;

  IF (
    SELECT count(*)<>1
    FROM public.staging_auth_bootstrap_provenance b
    JOIN public.organizations o
      ON o.id=b.organization_id
    JOIN public.user_profiles p
      ON p.id=b.admin_profile_id
    JOIN auth.users u
      ON u.id=b.auth_user_id
    WHERE b.id=foundation_provenance_id
      AND b.organization_id=foundation_organization_id
      AND b.admin_profile_id=foundation_profile_id
      AND b.auth_user_id=foundation_auth_user_id
      AND b.bootstrap_type='initial_owner'
      AND o.id=foundation_organization_id
      AND o.organization_type='internal'
      AND o.status='active'
      AND p.id=foundation_profile_id
      AND p.auth_user_id=foundation_auth_user_id
      AND p.organization_id=foundation_organization_id
      AND p.role='admin' AND p.status='active'
      AND p.client_id IS NULL AND p.candidate_id IS NULL
      AND pg_catalog.lower(pg_catalog.btrim(p.email))
        =b.normalized_admin_email
      AND pg_catalog.lower(pg_catalog.btrim(u.email))
        =b.normalized_admin_email
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_foundation_invalid';
  END IF;

  IF (SELECT count(*) FROM public.organizations)<>1
    OR (SELECT count(*) FROM public.user_profiles)<>1
    OR (SELECT count(*) FROM public.user_invites)<>0
    OR (SELECT count(*) FROM public.client_memberships)<>0
    OR (SELECT count(*) FROM public.candidate_accounts)<>0
    OR (SELECT count(*) FROM public.access_audit_logs)<>0
    OR (SELECT count(*) FROM public.staging_auth_bootstrap_provenance)<>1
  THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_baseline_invalid';
  END IF;

  IF (
    SELECT count(*)<>8
    FROM auth.users u
    JOIN LATERAL pg_catalog.jsonb_each(c->'auth_users') a
      ON u.id=(a.value->>'auth_user_id')::uuid
      AND pg_catalog.lower(pg_catalog.btrim(u.email))
        =pg_catalog.lower(pg_catalog.btrim(a.value->>'email'))
  ) OR EXISTS (
    SELECT 1
    FROM public.user_profiles p
    JOIN LATERAL pg_catalog.jsonb_each(c->'auth_users') a
      ON p.auth_user_id=(a.value->>'auth_user_id')::uuid
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_auth_inventory_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,organizations}') x
    WHERE x->>'creation_stage'<>'setup'
      OR x->>'organization_type' NOT IN('internal','client')
      OR x->>'status'<>'active'
      OR pg_catalog.btrim(x->>'name')=''
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') x
    WHERE x->>'creation_stage'<>'setup'
      OR x->>'role' NOT IN(
        'admin','recruiter_manager','recruiter','client','candidate'
      )
      OR x->>'status' NOT IN('active','invited')
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,memberships}') x
    WHERE x->>'creation_stage'<>'setup' OR x->>'status'<>'active'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,candidate_accounts}') x
    WHERE x->>'creation_stage'<>'setup' OR x->>'status'<>'active'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,organizations}') x
    WHERE x->>'creation_stage'<>'admin_runtime'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,profiles}') x
    WHERE x->>'creation_stage'<>'admin_runtime'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,invites}') x
    WHERE x->>'creation_stage'<>'admin_runtime'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,memberships}') x
    WHERE x->>'creation_stage'<>'admin_runtime'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,candidate_accounts}') x
    WHERE x->>'creation_stage'<>'admin_runtime'
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_creation_stage_invalid';
  END IF;

  IF (
    SELECT count(*)<>6
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') p
    JOIN LATERAL pg_catalog.jsonb_each(c->'auth_users') a
      ON (a.value->>'auth_user_id')::uuid=(p->>'auth_user_id')::uuid
      AND pg_catalog.lower(pg_catalog.btrim(a.value->>'email'))
        =pg_catalog.lower(pg_catalog.btrim(p->>'email'))
  ) OR (
    SELECT count(*)<>1
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,memberships}') m
    JOIN pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') p
      ON (p->>'id')::uuid=(m->>'user_profile_id')::uuid
      AND p->>'role'='client' AND p->>'status'='active'
      AND (p->>'organization_id')::uuid=(m->>'organization_id')::uuid
      AND (p->>'client_id')::uuid=(m->>'client_id')::uuid
  ) OR (
    SELECT count(*)<>1
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,candidate_accounts}') a
    JOIN pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') p
      ON (p->>'id')::uuid=(a->>'user_profile_id')::uuid
      AND p->>'role'='candidate' AND p->>'status'='active'
      AND (p->>'candidate_id')::uuid=(a->>'candidate_id')::uuid
  ) OR (
    SELECT count(*)<>1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,profiles}') p
    JOIN LATERAL pg_catalog.jsonb_each(c->'auth_users') a
      ON a.key='inactive_candidate'
      AND (a.value->>'auth_user_id')::uuid=(p->>'auth_user_id')::uuid
      AND pg_catalog.lower(pg_catalog.btrim(a.value->>'email'))
        =pg_catalog.lower(pg_catalog.btrim(p->>'email'))
      AND p->>'role'='candidate' AND p->>'status'='inactive'
  ) OR (
    SELECT count(*)<>1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,invites}') i
    JOIN pg_catalog.jsonb_array_elements(c#>'{setup,organizations}') o
      ON (o->>'id')::uuid=(i->>'organization_id')::uuid
      AND o->>'logical_reference'='RLSV4-P5-V6-ORG-CLIENT-B'
      AND i->>'invited_role'='client' AND i->>'status'='pending'
  ) OR (
    SELECT count(*)<>1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,memberships}') m
    JOIN pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') p
      ON (p->>'id')::uuid=(m->>'user_profile_id')::uuid
      AND p->>'logical_reference'='RLSV4-P5-V6-PROFILE-INVITED-CLIENT'
      AND (p->>'organization_id')::uuid=(m->>'organization_id')::uuid
      AND (p->>'client_id')::uuid=(m->>'client_id')::uuid
  ) OR (
    SELECT count(*)<>1
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,candidate_accounts}') a
    JOIN pg_catalog.jsonb_array_elements(c#>'{admin_runtime,profiles}') p
      ON (p->>'id')::uuid=(a->>'user_profile_id')::uuid
      AND (p->>'candidate_id')::uuid=(a->>'candidate_id')::uuid
      AND p->>'role'='candidate' AND p->>'status'='inactive'
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_relationship_invalid';
  END IF;

  WITH configured_ids AS (
    SELECT (x->>'id')::uuid id
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,organizations}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,memberships}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,candidate_accounts}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,organizations}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,profiles}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,invites}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,memberships}') x
    UNION ALL SELECT (x->>'id')::uuid
    FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,candidate_accounts}') x
    UNION ALL SELECT (d.value#>>'{organization,id}')::uuid
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    UNION ALL SELECT (d.value#>>'{profile,id}')::uuid
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    UNION ALL SELECT (d.value#>>'{invite,id}')::uuid
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    UNION ALL SELECT (d.value#>>'{membership,id}')::uuid
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    UNION ALL SELECT (d.value#>>'{candidate_account,id}')::uuid
    FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
    UNION ALL SELECT (d.value#>>'{audit,id}')::uuid
    FROM LATERAL pg_catalog.jsonb_each(c->'immutable_attempts') d
    UNION ALL SELECT (d.value#>>'{provenance,id}')::uuid
    FROM LATERAL pg_catalog.jsonb_each(c->'immutable_attempts') d
  )
  SELECT CASE
    WHEN count(*)=74
      AND count(DISTINCT id)=74
      AND count(*) FILTER(WHERE id IN(
        foundation_organization_id,foundation_profile_id,
        foundation_auth_user_id,foundation_provenance_id
      ))=0
    THEN 0 ELSE 1 END
  INTO mismatch_count
  FROM configured_ids;
  IF mismatch_count<>0 THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_foundation_overlap';
  END IF;

  IF EXISTS (
    WITH configured_ids AS (
      SELECT (x->>'id')::uuid id
      FROM pg_catalog.jsonb_array_elements(c#>'{setup,organizations}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{setup,memberships}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{setup,candidate_accounts}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,organizations}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,profiles}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,invites}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,memberships}') x
      UNION ALL SELECT (x->>'id')::uuid
      FROM pg_catalog.jsonb_array_elements(c#>'{admin_runtime,candidate_accounts}') x
      UNION ALL SELECT (d.value#>>'{organization,id}')::uuid
      FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
      UNION ALL SELECT (d.value#>>'{profile,id}')::uuid
      FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
      UNION ALL SELECT (d.value#>>'{invite,id}')::uuid
      FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
      UNION ALL SELECT (d.value#>>'{membership,id}')::uuid
      FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
      UNION ALL SELECT (d.value#>>'{candidate_account,id}')::uuid
      FROM LATERAL pg_catalog.jsonb_each(c->'denied_attempts') d
      UNION ALL SELECT (d.value#>>'{audit,id}')::uuid
      FROM LATERAL pg_catalog.jsonb_each(c->'immutable_attempts') d
      UNION ALL SELECT (d.value#>>'{provenance,id}')::uuid
      FROM LATERAL pg_catalog.jsonb_each(c->'immutable_attempts') d
    )
    SELECT 1 FROM (
      SELECT id FROM public.organizations
      UNION ALL SELECT id FROM public.user_profiles
      UNION ALL SELECT id FROM public.user_invites
      UNION ALL SELECT id FROM public.client_memberships
      UNION ALL SELECT id FROM public.candidate_accounts
      UNION ALL SELECT id FROM public.access_audit_logs
      UNION ALL SELECT id FROM public.staging_auth_bootstrap_provenance
    ) existing JOIN configured_ids USING(id)
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_fixture_conflict';
  END IF;

  BEGIN
    INSERT INTO public.organizations(id,name,organization_type,status)
    SELECT (x->>'id')::uuid,x->>'name',
      x->>'organization_type',x->>'status'
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,organizations}') x;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>3 THEN
      RAISE EXCEPTION USING errcode='P0001',
        message='phase5_v6_setup_organization_count_invalid';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_organization_insert_failed';
  END;

  BEGIN
    INSERT INTO public.user_profiles(
      id,auth_user_id,email,full_name,role,status,
      organization_id,client_id,candidate_id
    )
    SELECT
      (x->>'id')::uuid,(x->>'auth_user_id')::uuid,x->>'email',
      x->>'full_name',x->>'role',x->>'status',
      CASE WHEN x->'organization_id'='null'::jsonb
        THEN NULL ELSE (x->>'organization_id')::uuid END,
      CASE WHEN x->'client_id'='null'::jsonb
        THEN NULL ELSE (x->>'client_id')::uuid END,
      CASE WHEN x->'candidate_id'='null'::jsonb
        THEN NULL ELSE (x->>'candidate_id')::uuid END
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') x;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>6 THEN
      RAISE EXCEPTION USING errcode='P0001',
        message='phase5_v6_setup_profile_count_invalid';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_profile_insert_failed';
  END;

  BEGIN
    INSERT INTO public.client_memberships(
      id,user_profile_id,organization_id,client_id,status
    )
    SELECT
      (x->>'id')::uuid,(x->>'user_profile_id')::uuid,
      (x->>'organization_id')::uuid,(x->>'client_id')::uuid,
      x->>'status'
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,memberships}') x;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN
      RAISE EXCEPTION USING errcode='P0001',
        message='phase5_v6_setup_membership_count_invalid';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_membership_insert_failed';
  END;

  BEGIN
    INSERT INTO public.candidate_accounts(
      id,user_profile_id,candidate_id,status
    )
    SELECT
      (x->>'id')::uuid,(x->>'user_profile_id')::uuid,
      (x->>'candidate_id')::uuid,x->>'status'
    FROM pg_catalog.jsonb_array_elements(c#>'{setup,candidate_accounts}') x;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN
      RAISE EXCEPTION USING errcode='P0001',
        message='phase5_v6_setup_candidate_account_count_invalid';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_candidate_account_insert_failed';
  END;

  SELECT
    (SELECT count(*)
     FROM public.organizations o
     JOIN pg_catalog.jsonb_array_elements(c#>'{setup,organizations}') x
       ON o.id=(x->>'id')::uuid
      AND o.name=x->>'name'
      AND o.organization_type=x->>'organization_type'
      AND o.status=x->>'status')<>3
    OR
    (SELECT count(*)
     FROM public.user_profiles p
     JOIN pg_catalog.jsonb_array_elements(c#>'{setup,profiles}') x
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
          THEN NULL ELSE (x->>'candidate_id')::uuid END)<>6
    OR
    (SELECT count(*)
     FROM public.client_memberships m
     JOIN pg_catalog.jsonb_array_elements(c#>'{setup,memberships}') x
       ON m.id=(x->>'id')::uuid
      AND m.user_profile_id=(x->>'user_profile_id')::uuid
      AND m.organization_id=(x->>'organization_id')::uuid
      AND m.client_id=(x->>'client_id')::uuid
      AND m.status=x->>'status')<>1
    OR
    (SELECT count(*)
     FROM public.candidate_accounts a
     JOIN pg_catalog.jsonb_array_elements(c#>'{setup,candidate_accounts}') x
       ON a.id=(x->>'id')::uuid
      AND a.user_profile_id=(x->>'user_profile_id')::uuid
      AND a.candidate_id=(x->>'candidate_id')::uuid
      AND a.status=x->>'status')<>1
  INTO mismatch;

  IF mismatch THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_exact_match_failed';
  END IF;

  IF (SELECT count(*) FROM public.organizations)<>4
    OR (SELECT count(*) FROM public.user_profiles)<>7
    OR (SELECT count(*) FROM public.user_invites)<>0
    OR (SELECT count(*) FROM public.client_memberships)<>1
    OR (SELECT count(*) FROM public.candidate_accounts)<>1
    OR (SELECT count(*) FROM public.access_audit_logs)<>0
    OR (SELECT count(*) FROM public.staging_auth_bootstrap_provenance)<>1
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      JOIN pg_catalog.jsonb_array_elements(c#>'{admin_runtime,organizations}') x
        ON o.id=(x->>'id')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      JOIN pg_catalog.jsonb_array_elements(c#>'{admin_runtime,profiles}') x
        ON p.id=(x->>'id')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM public.user_invites i
      JOIN pg_catalog.jsonb_array_elements(c#>'{admin_runtime,invites}') x
        ON i.id=(x->>'id')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM public.client_memberships m
      JOIN pg_catalog.jsonb_array_elements(c#>'{admin_runtime,memberships}') x
        ON m.id=(x->>'id')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM public.candidate_accounts a
      JOIN pg_catalog.jsonb_array_elements(c#>'{admin_runtime,candidate_accounts}') x
        ON a.id=(x->>'id')::uuid
    )
  THEN
    RAISE EXCEPTION USING errcode='P0001',
      message='phase5_v6_setup_final_state_invalid';
  END IF;
END
$phase5_v6_setup$;

COMMIT;

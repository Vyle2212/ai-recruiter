# Staging Auth Validation Plan

Instructions only. Phase 1 schema and Phase 2 V4 helpers completed externally. The V6 privilege patch, bootstrap, RLS, and rollbacks have not executed.

**V3 READ-ONLY PREFLIGHT PASSED.**
**V4 CHAIN REJECTED.**
**V5 BOOTSTRAP REMAINS BLOCKED.**
**V6 PRIVILEGE PATCH PENDING MANUAL REVIEW.**
**STATIC REVIEW DOES NOT VALIDATE FORCE RLS BEHAVIOR.**
**REAL STAGING VALIDATION REQUIRED.**
**PRODUCTION REMAINS BLOCKED.**

V3 preflight evidence: `STG-PREFLIGHT-V3-20260723-01`.

Phase 2 structural verification passed, but privilege verification found effective `authenticated` and `anon` EXECUTE access on all nine V4 helper functions. V6 revokes all application-role grants before granting `authenticated` access only to the six identity helpers. It deliberately does not change default privileges. Future public-schema functions require explicit privilege review.

After V6 fingerprint review and explicit owner approval, validation must first verify the corrected function privilege matrix. Remaining categories are:

1. V4 read-only preflight and final rollback.
2. Exact migration role and object-owner validation.
3. V6 function grants: authenticated identity helpers only; PUBLIC, anon, service_role, and trigger-only access denied.
4. Missing, invited, inactive, suspended, and disabled identity denial.
5. Active admin, recruiter_manager, recruiter, client, and candidate helper behavior.
6. FORCE RLS direct-table denial.
7. Policy recursion and stack behavior.
8. Protected-column update rejection.
9. Cross-organization, cross-client, and cross-candidate denial.
10. V5 bootstrap Auth/profile email match and exact three-row verification.
11. Provenance admin-read-only behavior and normal-role denial.
12. Reverse-order rollback drill using the V5 exact-provenance bootstrap rollback.

No production data, candidate-domain data, production credentials, or secret values may be used.
## V6 post-patch read-only verification SQL

Run only after separate manual approval and successful V6 execution. This verification is read-only and must end in rollback.

```sql
BEGIN;
SET TRANSACTION READ ONLY;

WITH expected(function_name, authenticated_expected) AS (
  VALUES
    ('set_staging_auth_updated_at', false),
    ('current_user_profile_id', true),
    ('current_user_role', true),
    ('current_user_organization_id', true),
    ('current_user_client_id', true),
    ('current_user_candidate_id', true),
    ('current_user_is_admin', true),
    ('guard_user_profile_protected_columns', false),
    ('reject_access_audit_log_mutation', false)
), actual AS (
  SELECT e.function_name, e.authenticated_expected, p.oid, p.proowner, p.proacl
  FROM expected e
  LEFT JOIN pg_proc p
    ON p.oid = to_regprocedure('public.' || e.function_name || '()')
)
SELECT
  function_name,
  oid IS NOT NULL AS function_exists,
  authenticated_expected,
  CASE WHEN oid IS NULL THEN NULL
       ELSE has_function_privilege('authenticated', oid, 'EXECUTE') END AS authenticated_can_execute,
  CASE WHEN oid IS NULL THEN NULL
       ELSE has_function_privilege('anon', oid, 'EXECUTE') END AS anon_can_execute,
  CASE WHEN oid IS NULL THEN NULL
       ELSE has_function_privilege('service_role', oid, 'EXECUTE') END AS service_role_can_execute,
  CASE WHEN oid IS NULL THEN NULL ELSE EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(proacl, acldefault('f', proowner))) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) END AS public_can_execute
FROM actual
ORDER BY function_name;

SELECT count(*) AS expected_function_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.pronargs = 0
  AND p.proname IN (
    'set_staging_auth_updated_at','current_user_profile_id','current_user_role',
    'current_user_organization_id','current_user_client_id','current_user_candidate_id',
    'current_user_is_admin','guard_user_profile_protected_columns',
    'reject_access_audit_log_mutation'
  );

SELECT count(*) AS expected_trigger_count
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND t.tgname IN (
    'organizations_set_updated_at','user_profiles_set_updated_at',
    'user_profiles_guard_protected','user_invites_set_updated_at',
    'client_memberships_set_updated_at','candidate_accounts_set_updated_at',
    'access_audit_logs_reject_update','access_audit_logs_reject_delete'
  );

SELECT count(*) AS policy_count
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'organizations','user_profiles','user_invites','client_memberships',
    'candidate_accounts','access_audit_logs','staging_auth_bootstrap_provenance'
  );

SELECT
  count(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled_count,
  count(*) FILTER (WHERE c.relforcerowsecurity) AS rls_forced_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'organizations','user_profiles','user_invites','client_memberships',
    'candidate_accounts','access_audit_logs','staging_auth_bootstrap_provenance'
  );

SELECT sum(row_count) AS total_table_rows
FROM (
  SELECT count(*) AS row_count FROM public.organizations
  UNION ALL SELECT count(*) FROM public.user_profiles
  UNION ALL SELECT count(*) FROM public.user_invites
  UNION ALL SELECT count(*) FROM public.client_memberships
  UNION ALL SELECT count(*) FROM public.candidate_accounts
  UNION ALL SELECT count(*) FROM public.access_audit_logs
  UNION ALL SELECT count(*) FROM public.staging_auth_bootstrap_provenance
) counts;

SELECT
  public.current_user_profile_id() IS NULL AS profile_denied,
  public.current_user_role() IS NULL AS role_denied,
  public.current_user_organization_id() IS NULL AS organization_denied,
  public.current_user_client_id() IS NULL AS client_denied,
  public.current_user_candidate_id() IS NULL AS candidate_denied,
  public.current_user_is_admin() IS FALSE AS admin_denied;

ROLLBACK;
```

Expected: nine functions, eight triggers, zero policies, zero RLS-enabled/forced tables, zero rows, safe missing-profile results all true, and the exact role/function privilege matrix described above.
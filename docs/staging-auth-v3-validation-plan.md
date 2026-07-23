# Staging Auth Validation Plan

Instructions only. No V5 command or mutation has been executed.

**V3 READ-ONLY PREFLIGHT PASSED.**
**V4 CHAIN REJECTED.**
**V5 PENDING MANUAL REVIEW.**
**STATIC REVIEW DOES NOT VALIDATE FORCE RLS BEHAVIOR.**
**REAL STAGING VALIDATION REQUIRED.**
**PRODUCTION REMAINS BLOCKED.**

V3 preflight evidence: `STG-PREFLIGHT-V3-20260723-01`.

V5 is a minimal composite patch: it reuses the unchanged V4 preflight, schema, helpers, RLS, and their phase rollbacks while replacing only the rejected bootstrap and bootstrap rollback. The V5 pair uses `v_bootstrap_reference` and explicitly qualified provenance columns. No SQL has been executed.

After V5 fingerprint review, backup confirmation, and explicit owner approval, validation categories remain:

1. V4 read-only preflight and final rollback.
2. Exact migration role and object-owner validation.
3. Function grants and PUBLIC revocation.
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
# Staging Auth Validation Plan

Instructions only. No V4 command or mutation has been executed.

**V3 READ-ONLY PREFLIGHT PASSED.**
**STATIC REVIEW DOES NOT VALIDATE FORCE RLS BEHAVIOR.**
**REAL STAGING VALIDATION REQUIRED.**
**PRODUCTION REMAINS BLOCKED.**

V3 preflight evidence: `STG-PREFLIGHT-V3-20260723-01`.

V4 adds exact `auth.uid()` compatibility checks, table-scoped conflict checks, exact placeholder validation, Auth/profile email consistency, and immutable bootstrap provenance. The V4 preflight remains pending manual review and has not run.

After fingerprint review, backup confirmation, and explicit approval, validation categories are:

1. V4 read-only preflight and final rollback.
2. Exact migration role and object-owner validation.
3. Function grants and PUBLIC revocation.
4. Missing, invited, inactive, suspended, and disabled identity denial.
5. Active admin, recruiter_manager, recruiter, client, and candidate helper behavior.
6. FORCE RLS direct-table denial.
7. Policy recursion and stack behavior.
8. Protected-column update rejection.
9. Cross-organization, cross-client, and cross-candidate denial.
10. Bootstrap Auth/profile email match and exact three-row verification.
11. Provenance admin-read-only behavior and normal-role denial.
12. Reverse-order rollback drill with exact three-row bootstrap assertions.

No production data, candidate-domain data, production credentials, or secret values may be used.

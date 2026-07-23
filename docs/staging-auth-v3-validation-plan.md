# Staging Auth v3 Validation Plan

Instructions only. No command in this document has been executed.

**STATIC REVIEW DOES NOT VALIDATE FORCE RLS BEHAVIOR.**
**REAL STAGING VALIDATION REQUIRED.**
**PRODUCTION REMAINS BLOCKED.**

Use only after fingerprint review, backup confirmation, explicit manual approvals, and confirmation that the dedicated staging project is selected.

1. Preflight validation: confirm the read-only preflight passes and rolls back without mutation.
2. Migration-role validation: confirm the controlled executor is exactly `postgres` and the documented catalog privileges match.
3. Function-owner validation: inspect each created function owner and confirm SECURITY DEFINER functions are owned by `postgres`.
4. Function grants: confirm PUBLIC has no execution and `authenticated` has only the six approved identity-helper grants.
5. Missing/inactive identity behavior: test unauthenticated, missing, invited, inactive, suspended, and disabled profiles; expect NULL/false and denial.
6. Active-role helper behavior: test admin, recruiter_manager, recruiter, client, and candidate synthetic staging identities.
7. FORCE RLS direct-table denial: verify default denial and positive-policy access under the intended runtime roles.
8. Policy recursion/stack behavior: exercise every policy path and confirm no recursion, stack exhaustion, or unintended owner expansion.
9. Protected-column update rejection: attempt only synthetic staging changes to protected fields and expect the fixed denial.
10. Tenant denial: verify cross-organization, cross-client, and cross-candidate access is denied with synthetic records.
11. Bootstrap verification: confirm exactly one reviewed internal organization and one active admin profile match the immutable IDs.
12. Rollback drill: use the phase-specific reverse order and verify exact bootstrap row assertions and complete staging cleanup.

No production data, production credentials, real candidate data, or secret values may be used.

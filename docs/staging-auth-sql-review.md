# Staging Auth SQL Review

Read-only review package. It contains no credentials or project identifiers and authorizes no mutation.

## Review history

- V1: rejected.
- V2: rejected.
- V3: read-only preflight passed; rejected for mutation execution.
- V4: authoritative, pending manual review.

V3 safe evidence: `STG-PREFLIGHT-V3-20260723-01`. The V3 preflight ran as `postgres` on 2026-07-23, returned no rows, used a read-only transaction, rolled back, and caused no database, candidate, or production mutation.

## V4 inventory and fingerprints

Execution order:

1. `supabase/preflight/202607230014_staging_auth_preflight_v4.sql` — `181a500cb170606165048690059d09ef467db8687a46a439169ec2288da31e09`
2. `supabase/migrations/202607230015_staging_auth_schema_v4.sql` — `a30351a050111fadb7f6939700c543a1bf53ae179568cf200d69e79bd266a6fb`
3. `supabase/migrations/202607230016_staging_auth_helpers_v4.sql` — `1b1d8f9393900d57972d97efddfe71fca4447fd238444b92433e1d9c98980105`
4. `supabase/bootstrap/202607230017_staging_initial_owner_bootstrap_v4.sql` — `a5e3408dca2de6093fb487c90e9f8562ed5e7b0d57b46cefff137575af3cf103`
5. `supabase/migrations/202607230018_staging_auth_rls_v4.sql` — `e61484fef2c633c7c146cb3b5c7a74584b700526156b191049288d98ea005a45`

Rollback order:

1. `supabase/rollback/202607230018_staging_auth_rls_rollback_v4.sql` — `6f83411e7abe88c88968ead29d56d656e1814ffcd09fb67fb6b4858710e7e352`
2. `supabase/rollback/202607230017_staging_initial_owner_bootstrap_rollback_v4.sql` — `f0656f45715d487f2c5be586362af14990af4a2f1bcc27b170cb37f977cf522a`
3. `supabase/rollback/202607230016_staging_auth_helpers_rollback_v4.sql` — `97b786ab8286fb69d083a2a4a342e8607f7a76f20ae39e7932a4dc7cd6692442`
4. `supabase/rollback/202607230015_staging_auth_schema_rollback_v4.sql` — `431b9453f7d731549d989d4de7df373dfbedf1355dcb487af7113d705555f903`

Any content change changes its fingerprint and requires a new review.

## V4 corrections

The catalog-only preflight retains the successful V3 checks and additionally verifies exact `auth.uid()` schema/name/zero-argument/UUID-return compatibility. Function conflicts are scoped by schema, name, and zero arguments. Trigger conflicts are scoped to their target public table. Policy conflicts are scoped to the intended public table and exact V4 name.

Placeholder guards use exact equality. The bootstrap locks the exact manually created staging Auth row, normalizes only that row’s email with `lower(btrim(...))`, and requires it to match the reviewed profile email without returning it in errors.

## Immutable bootstrap provenance

`staging_auth_bootstrap_provenance` stores a non-secret immutable record linking one explicit provenance UUID and reference to the exact organization, admin profile, Auth user, normalized email, and `initial_owner` type. Unique constraints allow exactly one initial-owner record. Foreign keys use `ON DELETE RESTRICT`.

The organization, profile, and provenance rows are inserted in one advisory-locked transaction with separate one-row assertions. Normal application roles have no INSERT, UPDATE, or DELETE policy. Active admins have SELECT only.

Rollback locks and validates the provenance, profile, and organization, including the exact organization name. It checks dependencies, deletes provenance first, then exactly one profile and exactly one organization, with three independent row-count assertions. The Auth user is retained.

## Preserved controls

Strict one-shot creation, constrained roles/statuses, no privileged default, role/ownership shapes, explicit foreign-key deletion, invite expiry, intentional global pending-invite uniqueness, no plaintext token, protected profile fields, immutable audit mutation guards, fixed search paths, minimum helper grants, FORCE RLS, zero DELETE policies, zero guest policies, and recruiter-manager data minimization remain.

No artifact creates or mutates the main candidate table, copies production data, creates sessions/cookies, sends email, or changes production.

## Remaining validation and approvals

FORCE RLS owner behavior, policy recursion, runtime grants, active/inactive identity behavior, protected updates, tenant isolation, bootstrap behavior, and rollback behavior still require controlled real staging validation. A backup and explicit human approval are required before any mutation.

- [ ] V4 fingerprints reviewed
- [ ] V4 preflight reviewed
- [ ] Backup confirmed
- [ ] Schema/helpers/bootstrap/RLS reviewed
- [ ] Rollback reviewed
- [ ] Explicit staging mutation approval recorded externally

**V3 READ-ONLY PREFLIGHT PASSED**
**V4 SQL NOT EXECUTED**
**MIGRATIONS NOT EXECUTED**
**BOOTSTRAP NOT EXECUTED**
**RLS NOT EXECUTED**
**ROLLBACK NOT EXECUTED**
**PRODUCTION BLOCKED**

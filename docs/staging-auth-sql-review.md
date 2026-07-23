# Staging Auth SQL Review v2

These immutable SQL files are review-only. Nothing in this pack has been executed. Production remains blocked.

## V1 rejection history

V1 is preserved unchanged as historical evidence. Its static review found no critical issues and three high execution blockers: no first-admin bootstrap, unverified SECURITY DEFINER ownership under forced RLS, and a rollback that was unsafe for partial application. V1 status is **rejected for execution** and it is no longer authoritative.

| V1 historical artifact | SHA-256 | Status |
|---|---|---|
| `supabase/migrations/202607230001_staging_auth_schema.sql` | `163ce8e584e600eb6ee6f96e6dc1ffcca4e9a62abfa3c957b143d9f2cde83f71` | Rejected; not executed |
| `supabase/migrations/202607230002_staging_auth_helpers.sql` | `ac4309c336517ec191b7bfb169ed904b5fb0d05cad3f98b0f1ba80cab521bdea` | Rejected; not executed |
| `supabase/migrations/202607230003_staging_auth_rls.sql` | `07d481691a6653fb482eba6311b9b071a1bb5636f10a4266a09cea9b28d1d9c6` | Rejected; not executed |
| `supabase/rollback/202607230001_staging_auth_rollback.sql` | `1132377df44b4b54649ca4578a83013020dd2e40086d8eab1f29acea7c56973b` | Rejected; not executed |

## V2 authoritative inventory

| V2 artifact | SHA-256 | Status |
|---|---|---|
| `supabase/preflight/202607230004_staging_auth_preflight.sql` | `ec47f74aaef2a58538bd58c4fb3eb7fe9a962a9973329eebc19d1a987e6bfc25` | Pending manual review; not executed |
| `supabase/migrations/202607230005_staging_auth_schema_v2.sql` | `dd5c8fbb548639701d470374a55fa685eb5ac44de106d1507dc95f271169cd1e` | Pending manual review; not executed |
| `supabase/migrations/202607230006_staging_auth_helpers_v2.sql` | `3d808c73cd9433cb0d928f957bfdaca1bd1fdb9e6094bf5e38652655a8fb07bb` | Pending manual review; not executed |
| `supabase/migrations/202607230007_staging_auth_rls_v2.sql` | `cec648000cb1c0e22b404927e3029dc545e75d56ad2beea60505cdd7a19f4001` | Pending manual review; not executed |
| `supabase/bootstrap/202607230008_staging_first_admin_bootstrap_template.sql` | `ecd63a2346dac24643a12a674a67ecb6117ebf6ad3740014828b9827d82471f5` | Pending manual review; not executed |
| `supabase/rollback/202607230007_staging_auth_rls_rollback_v2.sql` | `87e56c32361d192dc1f1e9218b6fed598d0654172ff3461435ed7829f3464c60` | Pending manual review; not executed |
| `supabase/rollback/202607230006_staging_auth_helpers_rollback_v2.sql` | `8ffe30c5ce10aca049cf807d9dbac4852d8d4757a9eef1f2a2688787ab4b0e88` | Pending manual review; not executed |
| `supabase/rollback/202607230005_staging_auth_schema_rollback_v2.sql` | `b58ec605dbfd82dac9905296315ad4dc0535cc797dc8839509093519b29ae064` | Pending manual review; not executed |

## Preflight and one-shot behavior

The preflight is a read-only transaction that reads PostgreSQL catalog metadata only. It requires `public`, `auth.users`, installed `pgcrypto`, `gen_random_uuid()`, and the reviewed `postgres` function owner with BYPASSRLS. It rejects conflicting auth tables/relations, helper functions, trigger names, and v2 policies. It never creates, alters, drops, or reads application rows.

V2 migrations use strict `CREATE` statements inside transactions. They are versioned, one-shot, staging-only, not rerunnable, and may proceed only after a clean preflight, matching fingerprints, backup evidence, and explicit approval. Retry is blocked by preflight instead of silently replacing objects.

## Schema and ownership decisions

Checks constrain roles and statuses. There is no role default and no seeded user. Role-shape rules require organization scope for recruiters, organization/client scope for clients, a candidate identifier for candidates, null client/candidate ownership for admins, and prohibit active guest profiles. Candidate organization remains optional; admin organization remains optional. Client and candidate identifiers are opaque staging UUIDs with no domain foreign keys.

`auth_user_id` has one UNIQUE constraint; its redundant v1 explicit unique index was removed. Invitations require expiry, default to seven days, and use a partial unique index allowing at most one pending invite per normalized email. Tokens and email delivery remain deferred.

## First-admin bootstrap

The bootstrap is a separate manual template, not a migration. It requires a previously created and manually confirmed staging Auth user and an existing reviewed active organization. Unreplaced placeholders, an existing active admin, a duplicate profile, a mismatched Auth identity, or a missing organization abort the transaction. It inserts exactly one active admin profile and includes a separately copied, exact-record rollback template. It never creates an Auth user or touches candidate records. Default approval is NO.

## SECURITY DEFINER ownership and forced RLS

The reviewed intended owner is the existing managed PostgreSQL migration-owner role `postgres`; no role is created. Preflight requires this role and BYPASSRLS. Helper functions are SECURITY DEFINER with fixed `pg_catalog, public` search paths, schema-qualified queries, no dynamic SQL, revoked PUBLIC execution, and minimum `authenticated` execution grants.

Because the owner bypasses RLS, the helper's direct `public.user_profiles` lookup does not re-enter policies that call the same helper. This is the recursion-control decision. It is not considered proven until staging validates unauthenticated, missing, invited, inactive, suspended, disabled, and every active role. Any owner mismatch or recursion means stop and keep implementation blocked.

## Data minimization and immutable audit

The broad Recruiter Manager `user_profiles` policy was removed. Team-profile listing is deferred until a restricted view can be proven safe under real staging RLS. Recruiter Managers can read their organization row and their own active profile only; team-profile listing remains blocked.

Audit logs have no INSERT, UPDATE, or DELETE application policy. BEFORE UPDATE and BEFORE DELETE triggers reject mutation with a fixed error. A database owner or superuser can still remove these controls; privileged maintenance therefore requires operational governance.

## RLS policy rules

RLS is enabled and forced on all six auth-foundation tables. INSERT uses WITH CHECK only. UPDATE uses USING and WITH CHECK. No DELETE policy exists. Guest/anon has no positive policy. Candidate-domain, assignment, job, submission, pack, and report access remains deferred.

## Pgcrypto choice

V2 requires `pgcrypto` to be installed and verifies both the extension and `gen_random_uuid()` during preflight. It does not create or modify extensions, which is safer for a managed staging project.

## Phase-specific rollback and partial-state matrix

Each rollback requires a confirmed staging backup, matching fingerprint, and manual approval. RLS rollback guards table-dependent policy drops with `to_regclass()`, revokes application access, then disables RLS. Helper rollback guards trigger drops and removes functions. Schema rollback alone drops tables in reverse dependency order.

| Observed state | Allowed rollback | Expected behavior |
|---|---|---|
| Schema never started | None | Nothing to remove; rerun preflight after review |
| Schema partially failed | Schema rollback, only after confirming transaction state | Removes any auth-foundation tables that survived; normally transaction rollback leaves none |
| Schema complete; helpers not started | Schema rollback | Removes tables in reverse dependency order |
| Helpers partially failed | Helper rollback, then schema rollback if required | Guarded trigger cleanup; function cleanup; optional schema cleanup |
| Helpers complete; RLS not started | Helper rollback, then schema rollback if required | Removes helper phase safely |
| RLS partially failed | RLS rollback, helper rollback, then schema rollback as required | Guarded policy cleanup, revoke access, disable RLS, then unwind dependencies |
| Full stack applied | RLS rollback, helper rollback, schema rollback | Complete reverse-order staging teardown |

## Candidate and production protection

No artifact creates, reads, copies, alters, updates, deletes, or drops a candidate-domain table. No production candidate copy is required. Jobs, submissions, packs, reports, production objects, sessions, cookies, users, email, and middleware remain untouched.

## Outstanding manual review

- [ ] Review all v2 fingerprints
- [ ] Review preflight catalog assertions
- [ ] Confirm the `postgres` owner/BYPASSRLS behavior in dedicated staging
- [ ] Review schema and role-shape constraints
- [ ] Review every RLS policy and deferred access area
- [ ] Confirm backup and review all rollback phases
- [ ] Review the first-admin identity and organization procedure
- [ ] Approve bootstrap separately
- [ ] Run forced-RLS role tests only after a future explicit execution decision
- [ ] Record explicit staging-only approval externally

SQL NOT EXECUTED
MIGRATIONS NOT EXECUTED
RLS NOT EXECUTED
BOOTSTRAP NOT EXECUTED
ROLLBACK NOT EXECUTED
PRODUCTION BLOCKED

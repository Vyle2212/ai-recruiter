# Staging Auth SQL Review v1

These files are immutable, staging-only review artifacts. They are the authoritative SQL source; the older TypeScript generators remain deprecated display drafts for backward compatibility.

## Artifacts and fingerprints

| Artifact | SHA-256 | Status |
|---|---|---|
| `supabase/migrations/202607230001_staging_auth_schema.sql` | `163ce8e584e600eb6ee6f96e6dc1ffcca4e9a62abfa3c957b143d9f2cde83f71` | Pending manual review; not executed |
| `supabase/migrations/202607230002_staging_auth_helpers.sql` | `ac4309c336517ec191b7bfb169ed904b5fb0d05cad3f98b0f1ba80cab521bdea` | Pending manual review; not executed |
| `supabase/migrations/202607230003_staging_auth_rls.sql` | `07d481691a6653fb482eba6311b9b071a1bb5636f10a4266a09cea9b28d1d9c6` | Pending manual review; not executed |
| `supabase/rollback/202607230001_staging_auth_rollback.sql` | `1132377df44b4b54649ca4578a83013020dd2e40086d8eab1f29acea7c56973b` | Pending manual review; not executed |

## Schema decisions

- Named `CHECK` constraints enforce roles (`admin`, `recruiter_manager`, `recruiter`, `client`, `candidate`, `guest`) and lifecycle statuses. Checks were chosen over enums to make vocabulary changes and rollback explicit.
- No role has a default and no privileged user is seeded.
- Only `active` profiles resolve through security helpers. Missing, invited, inactive, suspended, or disabled profiles resolve to `NULL`/`false` and receive no positive policy.
- `auth_user_id` references `auth.users` with `ON DELETE RESTRICT`; organization and membership ownership also use `RESTRICT`. Audit actors use `SET NULL` to preserve append-only evidence.
- `client_id` and `candidate_id` remain opaque staging UUIDs. Their canonical foreign keys are deferred; no candidate domain table is created or modified.
- All intended uniqueness and ownership indexes are emitted against their named columns.

## Protected-column strategy

A `BEFORE UPDATE` guard rejects changes to role, status, auth identity, ownership IDs, and creation time unless the acting profile is an active admin. RLS limits self-update rows; the trigger protects privilege-bearing columns. Errors use fixed safe codes.

## Helper security model

Policy helpers derive identity only from `auth.uid()`. They are `SECURITY DEFINER` to avoid recursive `user_profiles` RLS, use fixed `pg_catalog, public` search paths, schema-qualified objects, no dynamic SQL, and minimum `authenticated` execute grants. Their owner and execution grants require manual staging review.

## RLS matrix

- Admin: SELECT/INSERT/UPDATE on auth-foundation tables; no DELETE. Audit logs are SELECT-only.
- Recruiter Manager: own organization and active profiles in that organization; no audit-log access.
- Recruiter: own active profile and own internal organization; assignment access deferred.
- Client: own active profile, exact active membership, and own client organization; domain jobs/submissions/packs/reports deferred.
- Candidate: own active profile and exact synthetic staging account mapping; main candidate access deferred.
- Guest/anon: no positive policy or table grant.

INSERT policies use `WITH CHECK` only. UPDATE policies use both `USING` and `WITH CHECK`.

## Candidate-data protection

No production candidate copy is required or permitted. The artifacts do not create, alter, update, delete, or drop the main candidate table. Candidate account IDs are synthetic staging mappings only; automatic assignment is prohibited.

## Rollback

Rollback requires a confirmed staging backup and explicit manual approval. It drops policies, then triggers, disables RLS additions, drops functions, and finally removes only the six auth-foundation tables in reverse dependency order. It does not touch candidates, jobs, submissions, packs, reports, or production objects.

## Known limitations and deferred work

- No canonical client or candidate foreign keys yet.
- No assignment, job, submission, pack, report, or main candidate policies.
- Invitation token storage/delivery and audit-log insertion are deferred.
- No SQL parser or real staging database validation has run.
- Function ownership, grants, query plans, and RLS behavior require manual staging review and tests.

## Manual review checklist

- [ ] SQL-01 schema fingerprint reviewed
- [ ] SQL-02 schema SQL reviewed
- [ ] SQL-03 RLS fingerprint reviewed
- [ ] SQL-04 RLS SQL reviewed
- [ ] Helper functions and owner/grants reviewed
- [ ] Protected-column guard reviewed
- [ ] All role/ownership policies reviewed
- [ ] Rollback artifact and backup evidence reviewed
- [ ] Explicit staging execution approval recorded externally

SQL NOT EXECUTED  
MIGRATIONS NOT EXECUTED  
RLS NOT EXECUTED  
PRODUCTION BLOCKED


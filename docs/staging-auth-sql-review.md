# Staging Auth SQL Review

This is a read-only manual-review pack. It contains no credentials or project identifiers and authorizes no execution.

## Review history

- **V1 rejection summary:** generated drafts lacked emitted constraints, valid ownership indexes, active-profile helpers, complete RLS, and safe rollback.
- **V2 rejection summary:** fingerprints matched, but the first admin had no safe organization-creation path; executor privileges and SECURITY DEFINER ownership assumptions were incomplete; bootstrap concurrency and rollback provenance required correction.
- V1 status: `rejected`.
- V2 status: `rejected`.
- V3 status: `pending_manual_review`.

## V3 artifact inventory and order

Execution order:

1. `supabase/preflight/202607230009_staging_auth_preflight_v3.sql`
2. `supabase/migrations/202607230010_staging_auth_schema_v3.sql`
3. `supabase/migrations/202607230011_staging_auth_helpers_v3.sql`
4. `supabase/bootstrap/202607230012_staging_initial_owner_bootstrap_v3.sql`
5. `supabase/migrations/202607230013_staging_auth_rls_v3.sql`

Rollback order:

1. `supabase/rollback/202607230013_staging_auth_rls_rollback_v3.sql`
2. `supabase/rollback/202607230012_staging_initial_owner_bootstrap_rollback_v3.sql`
3. `supabase/rollback/202607230011_staging_auth_helpers_rollback_v3.sql`
4. `supabase/rollback/202607230010_staging_auth_schema_rollback_v3.sql`

V3 SHA-256 fingerprints:

- Preflight: `37a8471e745cf168cae787e7f4e46b4fa89ceab3c1e368db6eacf012a1c45310`
- Schema: `e4a04ac3abe1042315119a8b1f8f29b3cbc929d78ae98a58b727d777f55ac744`
- Helpers: `70a9ebec14c39e23fc308bbdc4db0b00c3815da788cc6cd07246742ab1b34e27`
- Bootstrap: `59a446a82113c220c44277aa8b990e039fa02527b954478dd57f1eb960889a7e`
- RLS: `93faa66f04c905e7647e20cb8e136a2719765ae8097ea52d2091307f02228b95`
- RLS rollback: `f4f89243086c5a9cf431b567e07c81032a5bf6cfd1fdd4b7662adba4360f2b4c`
- Bootstrap rollback: `e7a85384036a7256538d1a7f94a256f902a414008b5e775840cb81d995cb38c6`
- Helpers rollback: `f7ccbb7a1f3eb836d3efc952b4b5370a8e617a9718c1143f9994875f9749ef6f`
- Schema rollback: `4503253487500295b9de84598624b87ed43e726483cf05e0ef4b6b6827604e15`

Fingerprints are calculated directly from the files by `lib/stagingAuthSqlArtifacts.ts`. Any edit changes a fingerprint and requires a new review.

## Execution-role and privilege decision

The preflight requires `current_user = 'postgres'`; it does not adapt to another executor. It checks `postgres`, `anon`, and `authenticated`, postgres BYPASSRLS, public/auth schemas, `auth.users`, pgcrypto, `gen_random_uuid()`, PL/pgSQL, current-user public USAGE/CREATE and auth USAGE/metadata SELECT, and authenticated public USAGE. It reads catalogs and privilege functions only, runs in a read-only transaction, and rolls back.

Functions are created by and owned by `postgres`; v3 has no `ALTER FUNCTION OWNER` dependency. PUBLIC execution is revoked and only the six identity helpers are granted to `authenticated`. Fixed search paths and schema-qualified reads are mandatory. This static design does not prove managed staging ownership or FORCE RLS runtime behavior.

## Schema decisions

V3 carries forward strict one-shot tables, role/status and ownership-shape constraints, explicit delete behavior, corrected indexes, opaque client/candidate UUIDs, and append-only audit controls. No privileged role is defaulted. Active guest profiles are prohibited. The normalized-email pending-invite uniqueness is intentional: the current model has one application profile per normalized email and permits only one pending invite globally in staging. Multi-organization identity is a future product decision.

No plaintext invitation token is stored. Client and candidate domain foreign keys, assignments, jobs, submissions, packs, reports, and main candidate-table access remain deferred.

## Combined organization/admin bootstrap

The staging-only template requires a manually created and confirmed Auth user, explicit reviewed organization/profile/Auth UUIDs, normalized staging-only email, organization name, and safe evidence reference. A transaction-scoped advisory lock serializes bootstraps. After the lock, all conflicts are rechecked. Exactly one internal active organization and exactly one linked active admin profile must be inserted.

The matching rollback uses the same advisory lock and immutable IDs, validates every protected profile field, rejects dependencies, and requires exactly one profile and one organization deletion. It never deletes the Auth user.

## FORCE RLS validation

Static review cannot prove owner bypass, grants, recursion behavior, runtime-role semantics, or tenant denial. Follow `docs/staging-auth-v3-validation-plan.md` only after backup and explicit approval.

## Partial-state rollback matrix

| State | Approved rollback path |
|---|---|
| Nothing applied | None |
| Schema partially failed | Schema rollback |
| Schema complete, helpers not started | Schema rollback |
| Helpers partially failed | Helpers rollback, then schema rollback if approved |
| Helpers complete, bootstrap not started | Helpers rollback, then schema rollback |
| Bootstrap partially failed | Its transaction rolls back; verify, then bootstrap rollback only if exact rows committed |
| Bootstrap complete, RLS not started | Bootstrap, helpers, schema rollbacks |
| RLS partially failed or full stack applied | RLS, bootstrap, helpers, schema rollbacks |

Elevated database owners can remove audit immutability controls; privileged maintenance remains operationally governed.

## Candidate and production protection

No artifact creates, reads, copies, alters, updates, deletes, or drops the main candidate-domain table. No production candidate copy or production mutation is present. Only synthetic staging ownership UUIDs are modeled.

## Pending approvals

- [ ] V3 fingerprints reviewed
- [ ] Preflight and executor privileges reviewed
- [ ] Schema and helper ownership reviewed
- [ ] Combined bootstrap placeholders and evidence reviewed
- [ ] Every RLS policy reviewed
- [ ] Backup confirmed
- [ ] Four rollback phases reviewed
- [ ] FORCE RLS staging-validation plan approved
- [ ] Explicit staging-only execution approval recorded externally

**SQL NOT EXECUTED**
**MIGRATIONS NOT EXECUTED**
**BOOTSTRAP NOT EXECUTED**
**RLS NOT EXECUTED**
**ROLLBACK NOT EXECUTED**
**PRODUCTION BLOCKED**

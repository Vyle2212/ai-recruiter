# Acceptance #4: Copilot mutation and durable storage

The failing run was 34947494737, SHA 5e32ad0468b1c68d8d9f123ac64c1f98a0d1f166. It passed six tests, then the controlled mutation test expected 201 but received 500. Its `answer: { summary: ... }` was incompatible with the Copilot history store, which reads `answer.evidence.length` and `answer.suggestedActions.length`.

The replacement fixture satisfies RecruiterCopilotAnswer. The history route rejects malformed persisted fields with 400 before accessing them. Acceptance now reads history and decisions back through separate requests before deleting them, and verifies persisted rule settings.

## Storage changes

Copilot chat/history and automation decision/rule APIs use Supabase `recruiter_runtime_state`, on the application auth database. The seven automation preview/execution read APIs consume the same stored decisions/rules. Copilot is private to organization + profile; decisions and rules are shared within an organization. Route authorization runs before data access, and reviewer/updatedBy come from authenticated scope. The server-only service client never uses candidate-source credentials.

Revision compare-and-set retries avoid lost updates. Missing schema, credentials, database errors, or exhausted retries fail closed. There is no file, /tmp, or in-memory production fallback. Existing offline file-store utilities remain available for local scripts, while their pure transformations are reused by the runtime store.

The migration creates one metadata table, forces RLS, revokes public/anon/authenticated access, and grants server service_role CRUD only on that table. Organization and profile deletion cascade to runtime metadata. Cleanup explicitly checks that the run's organizations have no remaining runtime rows before clearing the ledger. Preflight checks the table exists before provisioning identities.

Legacy global local JSON history is not automatically imported: it has no trustworthy organization/profile ownership. Migration to a live environment would require a separately reviewed ownership/backfill plan. This patch is being deployed only to the existing isolated Acceptance branch/project.

## Validation

Passed locally:
- New durable-store regression: round trips, separate store instances, actor/tenant isolation, five concurrent appends without data loss, delete/reset, authoritative reviewer/updater, outage and contention failures, actual Supabase adapter scope/revision predicates.
- New route integration: malformed input 400; history and decision create/read/delete; organization/user isolation; recruiter/manager/admin write policy; client GET denial; rule readback/reset. Storage is injected for these tests, not a live database.
- Existing Copilot history, automation decisions, automation rule configuration regressions.
- Authorization Wave A (88 policies) and policy coverage (no missing/duplicate policies).
- Acceptance workflow contract, TypeScript noEmit, optimized Next production build (138 static pages).

Production build retains five existing dynamic filesystem tracing warnings in unrelated file stores. Other legacy mutation stores are outside this patch; this does not establish their deployed persistence.

## Required Acceptance setup

Run `scripts/sql/install-acceptance-runtime-storage.sql` once in the SQL editor of Supabase project `ai-recruiter-acceptance-a0123c9` (ref `iujucosewivndjpcjbuz`). It wraps the migration in a transaction with an explicit Acceptance marker guard. No new environment secrets are required.

After SQL succeeds and this commit's Vercel deployment is Ready, point ACCEPTANCE_BASE_URL at that deployment and run authenticated acceptance with its full commit SHA. Do not reuse the preceding deployment/SHA. The real database migration, FK cleanup, authenticated browser run, and deployment behavior remain unverified until then.

This patch does not change canonical employment extraction, SAP FICO assignment scoring, or Search V2 scoring. It does not complete the population audit or authenticated Experience verification required by writing block 39518. Production verification remains incomplete.

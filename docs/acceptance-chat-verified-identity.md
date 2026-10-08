# Acceptance candidate-chat verification review

SQL 006 is prepared for manual review only; it has not been applied.

The two candidate conversation RPCs and the message-scope trigger currently query
`auth.users` as SECURITY INVOKER. The acceptance service role cannot SELECT that
relation. Application authorization already checks the candidate via the Auth
Admin API on each request, but the database authorization queries still fail.

The proposed acceptance-only projection contains only Auth user ID and the exact
boolean `email_confirmed_at IS NOT NULL`. A SECURITY INVOKER Auth trigger maintains
it synchronously on insert and verification updates; the primary-key foreign key
cascades deletion. No timestamps, email addresses, metadata or credentials are
copied. Auth owns verification: `supabase_auth_admin` may maintain the projection;
`service_role` may only SELECT, and anon/authenticated have no schema/table access.
RLS and FORCE RLS are enabled. The application continues to read Auth directly.

SQL 006 checks the acceptance project marker and all three current definition
hashes. It changes the verified-identity relation/predicate in those existing functions.
It also removes the obsolete recruiter_support-only restriction from the live
recruiter-candidate RPC to match the approved any-active-subscription policy and
current application code. Active status, nonempty plan and validity dates remain
required. All account, consent, participant, organization, job, access and share
predicates and SECURITY INVOKER are preserved. It grants no Auth
SELECT and does not change SQL 003/004/005 or any production database.

## Verification

The PGlite PostgreSQL test compiles SQL 006 against sanitized read-only live function definitions (no user rows)
and verifies their exact expected hashes, backfill, Auth-role insert/update,
verification revocation, deletion cascade, service read-only privileges, denial
for anon/authenticated, preservation of invoker security and refusal to reapply.
It does not execute the full chat RPCs or establish live application PASS.

Run with an isolated install of `@electric-sql/pglite` and its module path:

```sh
PGLITE_MODULE_PATH=/absolute/path/to/pglite/dist/index.js node scripts/acceptanceChatVerifiedIdentity.test.mjs
```

## Required review and acceptance follow-up

Review the Auth trigger before applying. It runs in the Auth write transaction;
a trigger or privilege failure can block signup or verification changes. Validate
normal signup, confirmed-user creation, unconfirmation and deletion in acceptance
before proceeding. The table lock is limited to the manual acceptance transaction.

After approval/manual application, read back all privileges, RLS, trigger and
function definitions, then exercise the two candidate-chat channels with synthetic
verified accounts, consent, active subscription/share, revocation and denial cases
through the protected exact-build workflow. Keep portal/external flags off and PR
draft until all outstanding release gates pass. Do not rerun successful run 62.

# Private candidate data RLS cutover — 2026-09-23

## Verified production exposure

A read-only database privilege audit found 970 rows in `public.candidates`.
The `anon` role could select, insert and update that table while RLS was
disabled. The same direct grants existed on the candidate search index,
candidate email, recruiter note, backup and workflow tables. `sap_modules` and
`consulting_firms` had RLS enabled but retained public allow-all policies. This
is a confirmed authorization defect, not evidence that candidate data was
accessed by an unauthorized person.

## GitHub remediation batch

The shared legacy database client is now server-only and requires the service
role at runtime. Thirty-six legacy privileged API route files are registered
in the recruiter authorization policy map. The proxy
uses that map for both `/api/recruiter/*` and registered legacy routes, denies
unregistered recruiter endpoints, enforces active recruiter roles, same-origin
write checks, request-size limits and private no-store headers before a handler
can use the privileged client.

The manual production cutover artifact covers all 25 existing public data
tables. It validates the complete table set, removes existing permissive
policies, enables and forces RLS, revokes `public`, `anon` and `authenticated`
table privileges, and grants table operations only to `service_role`. It is
deliberately stored outside the automatic migration directory. It must not run
until this exact application revision passes authenticated acceptance and a
backup/rollback checkpoint exists.

## Verification and release status

Static regressions require 78 recruiter routes plus the 36 legacy privileged
routes to have unique method-level policies. They also assert server-only
client initialization, policy-aware proxy coverage and deny-by-default RLS SQL.
TypeScript typecheck and the focused security regressions pass locally. No
Supabase or Vercel mutation was made by this batch.

Production remains **NO_GO**. Exact-head CI, authenticated acceptance,
version-matched backup, controlled RLS execution/readback, reviewed candidate
backfill, live OCR provenance and exact-artifact promotion are still required.

# Production read-only re-verification — 2026-09-24

## Outcome

V131 used the approved, project-scoped Supabase connection only inside
repeatable-read, read-only transactions. The project reference was verified
before querying. Results were restricted to aggregate counts and catalog object
names; no candidate identifier, contact detail, filename, CV text or employment
payload was returned.

The production data baseline is unchanged:

- 970 candidates on `candidate-parser-v2`;
- 231 sources with 715 stored employment rows;
- 739 sources with an empty stored employment array;
- source text remains available for all 970 records;
- the latest candidate `updated_at` remains 2026-09-16 15:32:06.396 UTC.

The 739 gaps retain the same complete aggregate grouping: 416 heading/date
boundary, 227 project/client-heavy, 57 explicit employer label, 26 headed
table, nine other narrative/layout and four short or missing-source records.
The later 737-source / 2,160-row parser projection remains unpromoted evidence,
not production data.

## Security readback

The deny-by-default cutover has not run:

- all 25 target tables exist, but only two have RLS enabled and none has forced
  RLS;
- every target table retains at least one direct `anon` or `authenticated`
  data privilege;
- both audit views exist, neither uses `security_invoker`, and both remain
  directly selectable;
- six of seven target candidate/search RPCs exist, but none meets the complete
  fixed-search-path and service-role-only contract;
- `apply_reviewed_employment_promotion_batch(jsonb)` is not installed.

The Supabase security advisor independently reports one policy on an
RLS-disabled table, two owner-privileged audit views, 23 exposed public tables
without RLS and six functions with mutable `search_path`. Its separate warnings
for `vector` and `pg_trgm` in `public` require compatibility review and are not
silently folded into the existing cutover.

## Release consequence

This is read-only evidence: database writes, migrations, runtime configuration
changes and candidate-data exports are all zero. Production remains **NO_GO**.
The next security step requires explicit supervised write approval after a
restorable data backup and authenticated exact-artifact acceptance: install the
reviewed transaction RPC without calling it, retain the authorization snapshot,
run the prepared RLS/view/RPC cutover, then execute the fail-closed readback and
security-advisor verification. Private review, conflict adjudication,
backfill/search readback and live OCR remain separate blockers.

V131 also adds an exact-head documentation-integrity regression. It preserves
opening, middle and final markers plus a conservative size floor for the long
CV OCR release ledger, preventing a partial remote upload from silently
deleting historical release evidence again.

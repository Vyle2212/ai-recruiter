# Supabase employment promotion transaction adapter — 2026-09-24

## Outcome

V115 implements the database boundary required by the v114 all-or-nothing
employment promotion contract. The server adapter makes exactly one Supabase
RPC call for the complete reviewed batch. The PostgreSQL function locks every
candidate in deterministic identifier order before the first write, rechecks
the exact `updated_at` and complete stored employment array, accepts only a
strict append, writes all candidates in one transaction and performs exact
readback before returning.

Any missing candidate, duplicate identifier, stale version, changed stored
row, reordered or removed row, malformed operation, count mismatch, failed
update or failed readback raises an exception. PostgreSQL therefore rolls back
every earlier change in that RPC. The function is `SECURITY INVOKER`, pins
`search_path`, denies `PUBLIC`, `anon` and `authenticated`, and grants execution
only to `service_role`. The client module is explicitly server-only.

## Search consistency and privacy

The candidate search index contains a projection of canonical candidate data.
After the candidate rows are updated, matching index rows are deleted inside
the same transaction. This prevents stale employment from remaining
searchable; rebuilding and reading back those index rows remains a required
post-backfill step. A failed deletion or any later readback failure rolls back
the candidate updates as well.

Candidate identifiers and employment rows exist only in the private RPC
request. The RPC response and public checkpoint contain aggregate counts and
artifact fingerprints only. No real identifier, CV text, contact detail,
review manifest, backup or employment payload is committed.

## Controlled installation order

The SQL is a manual production artifact, not an automatic migration. The safe
order is:

1. deploy and authenticate the exact application artifact;
2. verify the private reviewed manifest and a restorable, version-matched data
   backup;
3. install `202609240002_reviewed_employment_promotion_transaction.sql` without
   calling the RPC;
4. capture the authorization snapshot, then run the RLS cutover and readback;
5. run the private batch only after explicit release authorization;
6. rebuild the invalidated search rows and verify candidate plus search
   readback before acceptance.

The authorization snapshot, cutover and readback now cover seven RPCs,
including this write RPC, so it cannot remain outside the deny-by-default
surface.

## Verification and limits

Synthetic regression verifies the single-RPC adapter, security boundary,
deterministic row locking, append-only preservation, optimistic version check,
exact readback, search-index invalidation, aggregate-only response and refusal
of database or response mismatches. The earlier v114 batch regression and the
private-data RLS regression also pass, together with TypeScript typecheck.

The SQL was not installed or executed and no Supabase/Vercel state or candidate
data was changed. The private 533-source reviewed manifest and backup still do
not exist; 108 conflicting sources still require adjudication. Live OCR,
authenticated exact-artifact acceptance, controlled installation/cutover,
reviewed backfill, search rebuild and complete readback remain mandatory.
Production remains **NO_GO**.

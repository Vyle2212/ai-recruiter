# Transactional employment promotion batch contract — 2026-09-24

## Outcome

The v113 gate protected one reviewed additive candidate at a time. V114 adds a
batch-level preflight and execution contract so the 506 empty-to-populated and
27 existing-additive sources can eventually be handled as a reviewed batch
without weakening the per-candidate safeguards.

The contract accepts only the private `reviewed_employment_promotion_manifest_v1`
artifact. It refuses an empty manifest, duplicate candidate identifiers, an
unexpected commit SHA, missing current state, stale source version, a manifest
that predates its reviews, invalid approval or any plan that is not
additive-only. The public preflight report
contains counts and fingerprints only; candidate identifiers and employment
rows stay in the private in-memory operations.

## Exact bindings

Preflight binds the batch to all of the following:

- the full 40-character code commit SHA;
- the complete reviewed manifest and every per-candidate approval;
- the complete ordered current employment state;
- the exact derived operations, additions and queue counts;
- the exact candidate set and latest source version.

Execution additionally requires a readback-verified backup matching both the
candidate set and complete source-state fingerprint. Release authorization must
name the same commit, manifest and preflight fingerprints and must not predate
the backup.

Inside the required repository transaction, every candidate is locked and
checked again. Both `updated_at` and the complete employment payload must match
preflight. The update must match exactly one row; the complete employment array
is read back; and `updated_at` must advance monotonically. Any failure throws
inside the transaction so all earlier writes in that batch roll back.

## Verification and limits

Synthetic regressions cover a two-source mixed additive batch, exact-head
binding, duplicate rejection, backup coverage, stale backup, authorization
binding, same-version concurrent payload changes, preflight tampering, exact
readback and rollback after a later candidate fails. No real identity, CV text,
contact data or employment content is committed.

This batch defines and tests the transaction interface; it deliberately does
not provide a non-transactional REST adapter and does not execute any database
write. A production adapter must prove a single database transaction with row
locks before it can implement this interface. The private reviewed manifest,
verified backup/readback, 108 conflict adjudications, live OCR, authenticated
exact-artifact acceptance and controlled RLS cutover/readback remain required.
Production remains **NO_GO**.

# Employment promotion execution artifact readback — 2026-09-24

## Outcome

The v119 workflow created a persisted private backup and release-authorization
artifact, but the v116 execution command still accepted only the summarized
operator bundle. That permitted a manually assembled bundle to reach the
write controls without reopening the two source artifacts.

V120 closes that gap. In write mode, the operator now requires the complete
private backup and authorization files as separate inputs. Before loading the
Supabase client it reopens both files, checks their owner-only permissions and
outside-repository paths, verifies their content fingerprints against the
current preflight and checks that their exact evidence matches the operator
bundle. Mismatched or missing artifacts refuse the write path. Dry-run remains
non-connecting and does not require the artifacts.

The write invocation, **only after all independent release gates and a human
review of the private evidence**, must include
`--bundle=/private/authorized.employment-promotion-private.json`,
`--backup=/private/backup.employment-promotion-private.json` and
`--authorization=/private/authorization.employment-promotion-private.json`
alongside the existing explicit commit/project/credential/confirmation controls.

## Limits

An SHA-256 fingerprint protects artifact integrity and linkage; it does not
authenticate who created the files or prove the snapshot came from production.
The operator must separately inspect the private review, source snapshot,
release authority and actual database backup before any runtime operation.
This code-only change did not generate a real private artifact or connect to
Supabase/Vercel. The existing 533 additive sources, 108 conflicts, source and
OCR review, backup, controlled RLS cutover, backfill/index rebuild/readback and
authenticated exact-artifact acceptance remain blockers. Production is
**NO_GO**.

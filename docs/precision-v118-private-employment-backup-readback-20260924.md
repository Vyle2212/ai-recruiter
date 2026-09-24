# Private employment backup readback — 2026-09-24

## Outcome

V118 replaces self-declared backup evidence with a deterministic private
backup/readback workflow for the reviewed additive employment batch. The
workflow accepts the finalized v117 operator bundle and a fresh complete
production snapshot, selects exactly the approved candidate set, and refuses
missing, extra, stale or changed candidate state.

The private backup artifact binds the exact commit, manifest, preflight,
candidate set and complete pre-write employment state. It is written outside
the repository with owner-only permissions, reopened from disk and verified
byte-for-structure through an immutable fingerprint before the sanitized
`readback_verified` evidence can be attached to a new operator bundle.

The public report contains counts and fingerprints only. Candidate IDs,
employment rows and source text remain private. Authorization is not created by
this step, and the resulting bundle remains non-write.

## Fail-closed controls

- Both private inputs must be outside the repository and use owner-only file
  permissions.
- Both outputs must be new files outside the repository, use the private
  filename suffix, differ from each other and are created with mode `0600`.
- The fresh snapshot must include every approved candidate and must match the
  reviewed `updated_at` plus complete stored employment payload exactly.
- The snapshot capture must not predate either the reviewed manifest or its
  latest source version.
- The persisted backup fingerprint, commit, manifest, preflight, candidate-set
  and source-state fingerprints must all match after file readback.
- Existing backup or authorization content is refused to prevent evidence from
  being silently replaced or reordered.

## Command

After the v117 review bundle is finalized and a fresh private production
snapshot is captured:

`npm run prepare:production-employment-backup -- --bundle=/private/operator.employment-promotion-private.json --snapshot=/private/fresh-snapshot.employment-promotion-private.json --backup=/private/backup.employment-promotion-private.json --output=/private/backup-ready.employment-promotion-private.json`

The command creates the private backup first, reopens and verifies it, then
creates the backup-ready operator bundle. It initializes no Supabase client and
performs no database write.

## Verification and limits

Synthetic coverage verifies a full-population snapshot containing unrelated
rows, exact approved-set selection, disk-readback-compatible fingerprints,
sanitized reporting, stale capture refusal, missing candidate refusal, changed
source-state refusal, backup tampering refusal and duplicate backup refusal.
The v112-v117 promotion regressions remain unchanged.

No real private snapshot or backup was available in this run. No production
client was initialized and no Supabase/Vercel state changed. Real private
review, fresh backup capture, authorization, controlled RLS/adapter install,
backfill plus search rebuild/readback, live OCR and authenticated acceptance
remain required. Production remains **NO_GO**.

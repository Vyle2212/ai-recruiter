# Production Trust release promotion

> Latest checkpoint: [v86 reviewed-original recovery and verified backfill](precision-reviewed-originals-v86-20260916.md). All 970 sources audited: 687 with employment / 1,997 rows; 283 remain unresolved. Seven originals were backfilled with 59 verified rows and five existing search indexes rebuilt; 1,216 fields passed readback and the other 963 candidates are unchanged. Overlap flags are 57 (two additional source-supported concurrent histories); malformed, duplicate and invalid-range counts remain zero. Local four-page OCR was reviewed, but deployed OCR and authenticated exact-artifact acceptance remain outstanding. Production remains NO_GO. Historical no-write statements below do not describe this batch.

> Latest code batch: [v85 labelled career records](precision-labelled-career-records-20260916.md). Full read-only comparison of 970 sources: eight previously empty sources recover 23 rows, and one existing truncated title is corrected. Current projection: 677 sources / 1,928 rows; 293 sources remain unresolved. All 1,904 other prior tuples are unchanged. Malformed/duplicate/invalid-range counts remain zero, overlap flags 55 and client/employer equality flags two. No new database write; production remains NO_GO.

> Previous correction: [v84 career row ownership correction](precision-career-row-ownership-20260916.md). Source review found cross-row date/title joins and project clients in v83 output despite green CI. The corrected read-only 970-source projection is 669 sources / 1,905 rows; 301 sources require review. Across 18 changed sources, 39 unsafe or superseded tuples are removed and five corrected/source-owned tuples added. Overlap flags fall from 60 to 55. Earlier v83 recovery/overlap claims are superseded as accuracy evidence. No new database write; production remains NO_GO.

> Historical code batch: [v82 interleaved career records](precision-interleaved-career-batch-20260916.md). All 970 sources compared: 27 previously empty sources recover 61 employment rows; all 1,796 prior tuples remain unchanged. Local totals: 650 sources / 1,857 rows, with 320 sources unresolved. Malformed, duplicate and invalid-range counts remain zero; overlap flags remain 55 and client/employer equality flags remain two. Plural project-section boundaries now prevent project dates from leaking into employment. No additional production data write.

> Previous code batch: [v76 career export recovery](precision-career-export-batch-20260916.md), checked against all 970 sources: 74 additional records recovered, 224 net additional employment rows, 484 sources still unresolved locally. This batch does not add production database writes; the verified nine-original backfill below remains the last data change.

> Current checkpoint (2026-09-16): [full 970-source audit and verified backfill](precision-full-population-audit-20260916.md). All 970 stored sources have been audited automatically. After explicit production confirmation, nine reviewed originals and their search indexes were backfilled atomically and read back successfully: 412 records / 1,267 employment rows, with 558 sources still requiring review. The other 961 candidates are unchanged. Continuous same-employer SAP periods include time between projects. Live OCR and authenticated exact-artifact acceptance remain outstanding. Historical scope/count/policy statements below do not override this checkpoint.

An authenticated acceptance run on a feature branch validates only the exact
commit SHA and deployment hash recorded in its sanitized report. A later merge
or squash creates a different revision and is not production evidence.

The release owner must use one of these promotion paths:

1. Deploy the exact protected release or main SHA after merge, then dispatch the
   acceptance workflow against that SHA and its HTTPS deployment.
2. Promote the immutable build artifact whose commit SHA, build ID and
   deployment hash already passed acceptance, without rebuilding it.

The release gate remains NO_GO until the promoted artifact identity matches the
accepted identity. Branch-only PASS_INTERNAL_ONLY or PASS_FULL_SCOPE means the
scoped acceptance suite passed; it is not authorization to deploy a different
commit.

## Historical verified code-only checkpoint

Parser commit `d91380801c128d4f9a700131aeab4a87de94ca07` passed the full
Production Trust push and pull-request workflows, including the mandatory CV
source-layout regression group. Both preview statuses also succeeded. This is
code, build and preview evidence only: it did not run live OCR, mutate or
backfill the database, audit the remaining 693 declared sources, or perform
authenticated acceptance against the exact deployable artifact. The release
gate therefore remains NO_GO.

Subsequent parser checkpoints and current subset counts are recorded in `cv-ocr-upload-release.md`. Always inspect the latest PR head and its CI results; the historical SHA above is not acceptance evidence for later commits.

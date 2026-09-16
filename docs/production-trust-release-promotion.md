# Production Trust release promotion

> Latest code batch: [v79 delimited employment recovery](precision-delimited-employment-batch-20260916.md). All 970 sources compared: 27 additional records and 35 net rows recovered; one suffix-fragment employer corrected, with the other 1,601 prior tuples retained. Local totals are 557 records / 1,637 rows, with 413 sources unresolved. Malformed, duplicate and invalid-range counts remain zero. Source-stated concurrent roles add one overlap review flag (54 → 55); client/employer equality flags remain two. No additional production data write.

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

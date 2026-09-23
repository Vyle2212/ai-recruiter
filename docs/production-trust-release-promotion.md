# Production Trust release promotion

> Latest code-only checkpoint: [v102 owned career spells and project ledgers](precision-v102-owned-career-spells-20260923.md). Read-only projection on the same 970-source snapshot reaches 726 sources / 2,105 rows, with 244 needing review and all 2,096 prior rows retained. Reviewed backfill/readback, live OCR and authenticated acceptance on the exact artifact remain release blockers (NO_GO).

> Latest code-only checkpoint: [v101 heading-bound career cards](precision-v101-headed-career-cards-20260923.md). The unchanged 970-source snapshot projects 723 sources / 2,096 rows, with 247 sources still requiring review. Nine source-owned rows are added without changing any prior employment tuple, project, estimate, or audit diagnostic. This is not database backfill or live acceptance. Reviewed adjudication and backfill/readback, live OCR, and authenticated acceptance on the exact promoted artifact still block production (NO_GO).

> Latest code-only checkpoint: [v100 dated career chronology](precision-v100-headed-chronology-20260923.md). The unchanged 970-source snapshot projects 714 sources / 2,087 rows, with 256 sources still requiring review. This is not a database backfill or deployed OCR acceptance. Reviewed source adjudication and backfill/readback, live OCR, and authenticated acceptance on the exact promoted artifact still block production (NO_GO).

> Latest code-only checkpoint: [v99 owned project ledgers](precision-v99-owned-project-ledgers-20260923.md). Read-only comparison on 970 existing sources recovers four employer-owned roles from two sources with four labelled project estimates. The 709-source / 2,075-row projection is not a database backfill or deployed OCR acceptance. Reviewed backfill/readback, live OCR and authenticated acceptance on the exact promoted artifact still block production (NO_GO).

> Latest code-only safety checkpoint: [v98 owned label boundaries](precision-v98-owned-label-boundaries-20260923.md). The 970-source result remains 707 sources / 2,071 rows; cached results from the weaker row-boundary reader are invalidated. Production stays NO_GO pending reviewed backfill/readback, live OCR and authenticated exact-artifact acceptance.

> Latest code-only checkpoint: [v97 labelled employer/client ledger](precision-v97-labelled-client-employer-20260923.md). On the same private 970-source snapshot, 22 source-owned rows are recovered across two sources with all prior 2,049 rows retained; production is NO_GO pending reviewed backfill/readback, live OCR and exact-artifact authenticated acceptance.

> Latest source-owned quality checkpoint: [v96 career row ownership](precision-v96-source-ownership-quality-20260923.md). Full 970-source read-only comparison corrects source ownership and deduplication: 705 sources / 2,049 employment rows; 265 remain under review. SAP experience and projects are unchanged. This is code verification only; reviewed backfill/readback, live OCR and authenticated acceptance on the promoted artifact remain required. Production is NO_GO.

> Latest calculation checkpoint: [v95 SAP Sales and Distribution consulting](precision-v95-sap-sd-experience-20260923.md). All 970 sources were compared read-only on the same input; one SAP duration changes, all employment and project records are unchanged. This is code verification only. Reviewed backfill/readback, live OCR and authenticated acceptance on the promoted artifact remain required; production is NO_GO.

> Latest checkpoint: [v94 career field boundaries](precision-v94-career-field-boundaries-20260923.md). Same private 970-source read-only comparison corrects 45 employer/title tuples on 38 sources while keeping every source date, current flag and total row count. Projection remains 705 sources / 2,053 employment rows; 265 sources need review. Malformed, duplicate and invalid-range diagnostics remain zero; overlap and employer/client review flags are unchanged. An earlier over-broad experiment was rejected after it created unreviewed rows. Local mandatory regressions and typecheck pass; exact-head CI, reviewed backfill/readback, live OCR and authenticated acceptance remain required. Production is NO_GO.

> Latest correction: [v93 piped career row ownership](precision-v93-piped-row-ownership-20260923.md). Re-projection of the same private 970-source snapshot preserves all 2,042 v90 employment tuples, adds 11 source-owned rows across three sources, and reaches 705 sources / 2,053 rows. The earlier v91 706/2,065 and repaired-head 706/2,060 projections are superseded because of borrowed titles, reversed columns or location-as-employer rows. The remaining 265 sources are grouped for review; zero malformed/duplicate/invalid-range diagnostics. This is read-only code verification. Reviewed backfill/readback, live OCR and authenticated acceptance on the exact artifact remain required; production is NO_GO.

> Latest checkpoint: [v91 piped employment ownership and candidate API security](precision-v91-piped-employment-security-20260918.md). A bounded `title | employer | period` reader initially projected 706/970 sources and 2,065 rows, but full regression found cross-row date borrowing. The repair preserves explicit date-first overlaps without assigning a following row's period; the projection must be regenerated before use as post-repair evidence. Candidate detail, search, legacy-data and validation endpoints now use recruiter authorization. Local related regressions and typecheck pass; exact-head CI, reviewed backfill/readback, deployed OCR and authenticated acceptance remain required. Production is NO_GO.

> Latest checkpoint: [v88 explicit employer field families](precision-explicit-employer-fields-v88-20260916.md). Full comparison on the reviewed post-backfill 970-source snapshot recovers 12 rows across nine previously empty sources and one populated source, preserves all 2,010 v87 tuples and reaches 700 sources / 2,022 rows. There are 270 sources without extracted employment. Malformed/duplicate/invalid-range counts remain zero; overlap and client/employer flags are unchanged. This is code-only; production remains NO_GO.

> Latest checkpoint: [v87 employer promotion and contract spells](precision-employer-promotion-spells-20260916.md). Full 970-source comparison recovers 13 rows on four previously empty sources, preserves all 1,997 prior tuples and reaches 691 sources / 2,010 employment rows. There are 279 sources without extracted employment. Audit flags are unchanged. This is a code-only batch; the verified seven-original backfill remains the latest database write. Production remains NO_GO.

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

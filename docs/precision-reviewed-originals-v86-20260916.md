# Reviewed originals and bounded recovery — 2026-09-16

Status: **NO_GO for production promotion**. This checkpoint supersedes the v85 counts and the statement that the nine-original backfill was the last database write.

## Changes and evidence

The v86 employment reader supports bounded numeric month dates, explicit contract employer/client annotations and Year/Description career tables. Invalid months, day-date fragments, reversed dates and project sections remain excluded. Across the original 970-source snapshot, these changes recover ten rows on three previously empty sources without removing any of the 1,928 prior employment tuples.

Original PDFs for seven additional unresolved profiles were matched to their stored sources and reviewed. Six used positioned native PDF extraction; one required actual local Tesseract OCR across all four pages. This is evidence of local OCR recovery, not acceptance of the deployed Google OCR integration. A lost PDF bullet exposed a duty sentence being interpreted as an employer; the layout reader now rejects that construction. Name normalization preserves final initials and surname-first headers without incorporating city lines. Unknown chronology no longer causes an old dated employer to be presented as current. The projection cache includes all contributing extractor versions.

## Executed database recovery

Seven reviewed candidate records were updated atomically with full-row concurrency guards and a private backup. The update restored layout-preserving source fields, persisted original-file hashes/extraction provenance, rebuilt canonical snapshots, and applied literal source-supported identity/title/module corrections. Five existing search indexes were rebuilt. Two profiles had no existing index and no qualifying module for index construction; neither was silently inserted into SAP search.

Readback verified 1,216 fields, all 59 reviewed employment tuples, five valid search documents and the two unchanged absent indexes. Hashes confirm that all other 963 candidates and their indexes were unchanged. This does not certify every experience metric or imply all seven profiles are searchable.

## Complete population audit

| Metric                                     |       v85 | After v86 and reviewed backfill |
| ------------------------------------------ | --------: | ------------------------------: |
| Audited sources                            |       970 |                             970 |
| Sources with employment                    |       677 |                             687 |
| Employment rows                            |     1,928 |                           1,997 |
| Sources without employment                 |       293 |                             283 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 |                       0 / 0 / 0 |
| Overlap review flags                       |        55 |                              57 |
| Client/employer equality flags             |         2 |                               2 |

The two additional overlap flags correspond to concurrent work present in the reviewed originals, including part-time/advisory roles. They remain visible for review. Forty-two employment rows lack complete date ranges and 118 lack titles; extraction coverage is not complete semantic acceptance. Missing dates are preserved as unknown rather than borrowed from client projects. Private originals, raw exports, backup, guarded update plan and readback evidence are not committed to this repository.

## Remaining release work

Project projections decrease from 156 to 155 after source restoration. The removed projection had merged two distinct assignments, concatenated environment text into its name and mixed responsibility blocks. Its original evidence is preserved; correctly separating and recovering those assignments remains review work rather than certifying the old merged row.

There are 283 sources without extracted employment, plus incomplete and ambiguous records requiring source review. The source database still has no original-file references; this batch's recovered originals carry hashes and recovery provenance instead of invented URLs. Live Google OCR with persisted provenance and authenticated acceptance on the exact artifact to promote remain required. No production promotion has been performed.

The mandatory CI source suite includes numeric-date, contract ownership, career-table bounds, lost-bullet handling, identity and cache-version regressions. The identity-readiness test now checks the existing centralized authorization gate before identity retrieval instead of asserting an obsolete authorization call inside that branch. No authorization behavior was relaxed.

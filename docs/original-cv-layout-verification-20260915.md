# Original CV layout verification — 2026-09-15

> Latest code batch: [v83 career ledger recovery](precision-career-ledger-batch-20260916.md). The read-only 970-source comparison reaches 674 sources / 1,939 employment rows, with 296 sources still requiring review. It recovers 24 previously empty sources and 82 rows while retaining all 1,857 v82 tuples. A specialization/module after an SAP role is explicitly prevented from becoming an employer. No original CV, identity, contact detail or source excerpt is committed.

> Latest code batch: [v82 interleaved career records](precision-interleaved-career-batch-20260916.md). All 970 sources compared: 27 previously empty sources recover 61 employment rows; all 1,796 prior tuples remain unchanged. Local totals: 650 sources / 1,857 rows, with 320 sources unresolved. Malformed, duplicate and invalid-range counts remain zero; overlap flags remain 55 and client/employer equality flags remain two. Plural project-section boundaries now prevent project dates from leaking into employment. No additional production data write.

> Previous code batch: [v76 career export recovery](precision-career-export-batch-20260916.md), checked against all 970 sources: 74 additional records recovered, 224 net additional employment rows, 484 sources still unresolved locally. This batch does not add production database writes; the verified nine-original backfill below remains the last data change.

> Current checkpoint (2026-09-16): [full 970-source audit and verified backfill](precision-full-population-audit-20260916.md). All 970 stored sources have been audited automatically. After explicit production confirmation, nine reviewed originals and their search indexes were backfilled atomically and read back successfully: 412 records / 1,267 employment rows, with 558 sources still requiring review. The other 961 candidates are unchanged. Continuous same-employer SAP periods include time between projects. Live OCR and authenticated exact-artifact acceptance remain outstanding. Historical scope/count/policy statements below do not override this checkpoint.

## Changes

PDF extraction now orders positioned text by visible rows, preserves word and column gaps, and keeps cells together for two explicitly headed employment-table formats. The table renderer is scoped to each document and retains original text rather than substituting employer names. Canonical employment receives the preserved source rather than a whitespace-flattened string.

DOCX extraction uses Mammoth's public document transform to retain soft line breaks. Its raw-text converter discarded those breaks, fusing titles and employers. Images and HTML are not emitted by this path.

The employment reader supports line-bounded company/date/title headings, role/Employer/Client tables, wrapped end years, and role/company/date headings. Client engagement dates are not copied into employer tenure. Duration-only table cells retain an explicit start without inventing an end date. Adjacent starts one month apart are not deduplicated when an end is missing. Education and detailed project sections remain outside this reader.

## Original-source evidence

Seven original PDFs (32 pages total) and one corresponding DOCX were inspected locally. No original CVs, names, contact details, or OCR text are committed. Before this change the uploaded PDFs each produced zero canonical employment rows through the upload parser.

| Source layout                                   | Employment rows after repair | Complete date ranges | Qualification                                                             |
| ----------------------------------------------- | ---------------------------: | -------------------: | ------------------------------------------------------------------------- |
| Corrupted PDF character mapping                 |                            5 |                    5 | Requires locally rendered OCR text; direct PDF upload is still unresolved |
| Five-column employment ledger                   |                           11 |                    2 | Nine ends are unspecified; duration alone does not establish an exact end |
| Sidebar heading and wrapped dates               |                            9 |                    9 | Contract clients remain separate from employers                           |
| Company / scope / year table                    |                            5 |                    5 | Includes an explicitly overlapping part-time engagement                   |
| Reordered content stream                        |                            3 |                    3 | Education and projects excluded from employment                           |
| Company and role with right-aligned dates       |                            6 |                    6 | Community and education entries excluded                                  |
| Employer/client tables plus older role headings |                           20 |                   10 | Actual PDF and DOCX yield identical company/title/date tuples             |

Total: 59 employment rows across seven CVs, including the five rows from offline OCR. This is not a claim of 59 distinct employers, complete candidate profiles, or successful production backfill. The OCR employment row labelled only “Current Position” leaves its title unassigned. The revised employer/client CV differs from the previously exported source version.

Character-inventory checks on all 32 PDF pages found no lost non-whitespace characters relative to the PDF text items. This checks text retention, not semantic reading-order correctness or OCR quality. Employment sections were also visually compared with the originals.

## Regression and release status

Synthetic tests cover PDF row ordering, fragmented words, both table formats, multi-page table continuation, per-document renderer isolation, DOCX soft breaks, client-date isolation, section boundaries, wrapped years and partial-date deduplication. Existing canonical, pinned-fixture, source-preservation and employment-pattern regressions were run. Typecheck and the webpack production build pass.

With the subsequent parser checkpoints documented in `cv-ocr-upload-release.md`, the unchanged 277-source export now yields 144 source records with employment / 552 employment rows, with 133 sources without employment. These are source records, not unique-person or complete-CV counts. Original files have not been written back to that export or the database; the 59 original-file rows must not be added to its counts as if backfill had occurred. The other 693 sources remain unaudited. Existing malformed, duplicate and invalid-range diagnostic counts remain zero.

Production remains NO_GO. The subsequent upload OCR integration is documented in `cv-ocr-upload-release.md`; live service verification remains outstanding. Authenticated database backfill, full-population audit, and deployed-SHA acceptance remain outstanding. Runtime Supabase/Vercel changes are outside this automated GitHub-only scope. No production data writes or production promotion were performed.

## Additional original-file batch — 2026-09-16

Eight additional PDFs (26 pages) and three corresponding DOCX files were reviewed locally. With parser `candidate-employment-v69-original-layout-batch`, PDF extraction produces **35 employment rows across eight CVs**, compared with one row across one CV at baseline `9f0d53e3cec910e506993fba69aba41c6ffdb8b0`. The three PDF/DOCX pairs have matching employer/title/start/end/current tuples after case folding; they are not counted as extra people or extra histories.

| Original layout                               | Rows | Qualification                                                                          |
| --------------------------------------------- | ---: | -------------------------------------------------------------------------------------- |
| Date / Company Name / Role table              |    6 | Start-only dates; project-labelled row remains unresolved                              |
| Right-hand dates wrapped across heading lines |    4 | Includes an explicitly written shared-year internship range                            |
| Two-column advisory history                   |    5 | Sidebar and client-list prose excluded from employers                                  |
| Two-column quality-assurance history          |    5 | Explicit freelance overlap retained                                                    |
| Numeric month/year headings                   |    3 | Communications role retained; references excluded                                      |
| Employer/location/tenure plus “Served as”     |    4 | Location separated; identical heading evidence merged without a duplicate untitled row |
| Date/employer heading with following role     |    6 | Location and reporting-manager annotations excluded from fields                        |
| Undated role-at-employer statements           |    2 | No tenure or SAP experience inferred; other event/gig entries remain unresolved        |

Every non-whitespace PDF text-item character is retained on all 26 pages. This is a text-retention check, not OCR verification. Employment headings were also inspected visually. DOCX multi-paragraph cells are paired only within an explicit Date / Company Name / Role row when all three cell counts agree; unequal cells remain raw source for review.

The original-file cohort is separate from the unchanged 277-source export (144 sources / 552 employment rows, 133 unresolved); no backfill occurred. Original-file counts must not be added to the export's recovered count. This batch does not establish complete histories: partial dates, an assignment-labelled table row and ambiguous event/gig entries remain visible review work. Two newly supplied identities do not replace a different, similarly named requested identity. Private review notes retain those distinctions and recruiter-provided date corrections without publishing names or source text.

Production remains **NO_GO**, with the same live OCR, reviewed backfill, 970-source audit and exact-artifact authenticated acceptance gates.

## Supplied four-column original and review-year estimate — 2026-09-16

The previously missing requested original is now available: five PDF pages with four employment tables, visually verified. `Period / Role / Industry / Description` establishes column ownership; the reader joins wrapped dates and split role words, retaining the legal employer at the start of the description. Client and project descriptions do not replace that employer. Canonical extraction improves from zero to four rows. Its current marker is retained as a source claim, not a new confirmation of present employment. The other new attachment is byte-identical to the earlier student CV and adds no new source evidence.

The prior eight-CV cohort remains 35 rows, independently of these four rows. Three PDF/DOCX pairs still agree, and all 33 currently supplied PDF pages retain their non-whitespace text-item characters (including two pages from the duplicate). No backfill occurred. The export now has 144 sources / 553 rows: the sole additional row retains a known year and current marker, with an explicit year-level tenure estimate authorized by the recruiter. Its unresolved month remains in source evidence. All 552 prior export tuples are unchanged; 133 sources remain unresolved and 693 remain unaudited. The release gates above remain NO_GO.

## Subsequent flattened-source batch — 2026-09-16

Parser `candidate-employment-v71-punctuated-row-batch` recovers 14 additional rows across four previously unresolved exported sources using date/role/comma boundaries, numbered role-colon rows and industry-labelled POSITION headings. The export now has 148 sources / 567 rows, with all 553 baseline tuples retained and 129 sources still without employment. No original file was substituted into the export. All 13 available original-file representations retain identical employment tuples, including duplicate/counterpart files, which are not extra people. The original-file cohort counts above therefore remain unchanged.

Some newly recovered histories still contain unsupported partial/ambiguous rows; the record counts are not complete-CV counts. The recruiter confirmed that one previously requested updated CV does not exist; retain the supplied version and its evidence limits without requesting another copy. Names and file identifiers remain only in private notes. Production remains NO_GO under the same runtime, reviewed backfill, full-population audit and exact-artifact acceptance gates.

## Chronological flattened-source batch — 2026-09-16

Parser `candidate-employment-v72-chronological-ledger-batch` adds 19 source-supported rows across nine export records using bounded chronological layouts. The 277-source export now contains **156 records with employment / 586 rows**, with 121 records still without employment. All 567 tuples from the prior export checkpoint remain unchanged. Overlap and possible client/employer equality review flags remain at nine and one respectively; malformed, duplicate and invalid-range counts remain zero.

The 13 available original-file representations still produce the same 57 employer/title/start/end/current tuples as the prior checkpoint. They were compared independently and were not written into the export. This batch does not alter the original-file cohort, replace a supplied source, or constitute database backfill. Production remains **NO_GO** for live OCR/provenance, reviewed/version-matched backfill, the other 693 population sources and authenticated exact-artifact acceptance.

## Heading-boundary flattened-source batch — 2026-09-16

Parser `candidate-employment-v73-heading-boundary-batch` recovers nine employment rows across eight previously unresolved export records. The unchanged 277-source export now yields **164 records / 595 rows**, with 113 records without employment. All 586 prior tuples are retained, with no additional malformed, duplicate, invalid-range, overlap or client/employer-equality flags.

The 13 currently available original-file representations remain unchanged at 57 tuples, independently of the export. This result does not close incomplete histories, substitute original files, backfill data or satisfy production acceptance. The live OCR/provenance, reviewed/version-matched backfill, full 970-source audit and authenticated exact-artifact gates remain **NO_GO**.

## Owned-field batch and explicitly labelled estimates — 2026-09-16

Parser `candidate-employment-v74-owned-fields-batch` increases the unchanged 277-source export from 164 / 595 to **176 sources / 627 employment rows**, retaining all prior source endpoint tuples; **101** sources still have no employment. The 13 original-file representations remain unchanged at 57 rows and are not added to the export. No original needs to be resent for the already-accessible table cases.

The recruiter subsequently authorized employer-tenure estimates from explicitly owned project ranges. Four otherwise undated employer rows now expose a separate, labelled project-envelope estimate; their original endpoints remain blank. This is an explicit change to the earlier no-project-date policy for _presentation of estimates_, not a claim that project dates are exact employment dates. For a clearly owned SAP employer, the SAP tenure estimate spans the first through last supported SAP project at that employer and may include internal-work gaps; non-SAP accounting, sales and end-user roles remain excluded. Overlapping periods are never double-counted. See the latest `cv-ocr-upload-release.md` checkpoint for the full group inventory, safety conditions and data comparison. All production gates remain NO_GO; no backfill or runtime mutation occurred.

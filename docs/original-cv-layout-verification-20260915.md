# Original CV layout verification — 2026-09-15

> Latest backup checkpoint: [v118 private employment backup readback](precision-v118-private-employment-backup-readback-20260924.md). The reviewed additive set now has a fail-closed private backup step: exact current source versions and stored employment payloads must be recaptured, written owner-only outside the repository and successfully read back before backup evidence can enter the operator bundle. This is code-only preparation; no real snapshot, backup, database connection or write occurred, and production remains NO_GO.

> Latest private-review checkpoint: [v117 private employment review pack](precision-v117-private-employment-review-pack-20260924.md). A private 970-source snapshot can now generate an immutable review pack covering all promotion queues while keeping candidate identifiers, CV text and employment rows out of public output. Additive decisions must be complete before finalization; conflicts cannot enter the additive backfill and may only reject the projection while retaining stored history or remain outstanding. The real private pack was not generated and no runtime state changed, so production remains NO_GO.

> Latest operator-safety checkpoint: [v116 employment promotion operator gate](precision-v116-employment-promotion-operator-gate-20260924.md). A dry-run-first operator now exposes only aggregate fingerprints, validates backup before authorization, rejects private bundles inside the repository, and requires the exact checked-out commit, Supabase project ref, service-role, write enablement and confirmation before the v115 RPC can run. Nothing was written or configured in production; production remains NO_GO.

> Latest transaction-adapter checkpoint: [v115 Supabase employment promotion transaction adapter](precision-v115-supabase-employment-transaction-adapter-20260924.md). A server-only one-RPC adapter now enforces deterministic full-batch locks, exact source/payload matching, strict additive preservation, atomic search-index invalidation and exact readback for the reviewed promotion path. The RPC joins the deny-by-default snapshot/cutover/readback surface. It remains uninstalled and unexecuted; no production state changed and all release gates remain NO_GO.

> Latest batch-safety checkpoint: [v114 transactional employment promotion contract](precision-v114-transactional-employment-promotion-batch-20260924.md). A complete private additive manifest can now be preflighted against the exact commit and complete source payload, then executed only through a row-locking transaction whose backup, authorization and readback fingerprints match. A stale or changed source, tampered operation or later readback failure aborts the whole batch. No source data or database state changed; production remains NO_GO.

> Latest backfill-safety checkpoint: [v113 reviewed additive employment promotion gate](precision-v113-reviewed-additive-employment-promotion-20260924.md). Only the 506 empty-to-populated and 27 existing-additive queues can become reviewable merge plans. Exact source version and three fingerprints bind approval to the complete stored history, complete persisted projection, exact additions and queue state; conflicts or concurrent changes fail closed. Stored rows are preserved and missing dates are not inferred. No production write occurred; production remains NO_GO.

> Latest promotion-safety checkpoint: [v112 version-matched employment projection audit](precision-v112-production-employment-projection-audit-20260924.md). The current parser was streamed read-only across all 970 production sources. It projects 737 sources / 2,160 rows, but 108 sources conflict with stored history and 223 of 715 stored tuples would be removed or changed by replacement. Full-array replacement is therefore blocked. The 506 empty-to-populated and 27 additive sources remain review queues, not approved writes. No identifiers, source excerpts or database writes were emitted; production remains NO_GO.

> Latest production data checkpoint: [v111 aggregate employment gap inventory](precision-v111-production-employment-gap-inventory-20260924.md). All 970 stored records were counted read-only without exporting source text or candidate identifiers: 231 sources / 715 employment rows are stored and 739 sources have empty employment arrays. After excluding trailing references sections, the complete stored-gap queues are 416 heading/date-boundary, 227 project/client-heavy, 57 explicit-employer-label, 26 headed-table, nine other-layout and four short-source records. This does not replace the latest 737-source / 2,160-row code projection or authorize backfill. Production remains NO_GO.

> Latest database-surface checkpoint: [v110 pre-cutover authorization snapshot](precision-v110-pre-cutover-authorization-snapshot-20260923.md). The read-only 737-source / 2,160-row projection is unchanged. The new fail-closed SQL captures authorization metadata for all 25 tables, two audit views and six RPCs before cutover, but it is not a data backup and has not run on production. Production remains NO_GO pending backup, controlled cutover/readback and the existing source, OCR, backfill and acceptance gates.

> Latest security checkpoint: [v107 private candidate data RLS cutover](precision-v107-private-data-rls-cutover-20260923.md). Production privilege inspection confirmed anonymous direct access to candidate and workflow tables. The remediation keeps candidate access server-side behind recruiter authorization and prepares a manual RLS cutover; it does not alter CV source text or the 737-source / 2,160-row read-only projection. No runtime write occurred and production remains NO_GO.

> Latest read-only checkpoint: [v103 bounded repeated career summaries](precision-v103-bounded-career-summaries-20260923.md). The same 970-source snapshot projects 730 sources / 2,129 employment rows, with 240 needing review and all 2,105 prior tuples retained. Start-only roles keep a missing end; operational SAP-user roles do not add SAP delivery years. Original-layout review, version-matched backfill/readback, live OCR and authenticated acceptance remain required (NO_GO).

> Latest source-card recovery: [v101 heading-bound career cards](precision-v101-headed-career-cards-20260923.md). A read-only 970-source comparison recovers nine first cards with explicit employer/role/date ownership, reaching 723 sources / 2,096 rows and leaving 247 for review. Legal clients cannot pass as locations; non-SAP titles remain outside SAP tenure. Original-source review and production gates remain pending (NO_GO).

> Latest source chronology: [v100 career heading/date rows](precision-v100-headed-chronology-20260923.md). Validated date-first role/employer ownership recovers 12 rows across five sources on a read-only 970-source projection: 714 sources / 2,087 rows, 256 unresolved. Numeric dates require unambiguous day-first evidence within the same source. Original review and production gates remain pending (NO_GO).

> Latest source-owned project layout: [v99 employer/customer ledgers](precision-v99-owned-project-ledgers-20260923.md). Company/Employer and Customer/End-Client are bounded within the same record; project stage dates are shown only as estimated tenure and require original-source review before backfill. Read-only 970-source projection: 709 sources / 2,075 rows, 261 unresolved; production NO_GO.

> Latest parser safety checkpoint: [v98 owned label boundaries](precision-v98-owned-label-boundaries-20260923.md). Incomplete labelled career rows cannot borrow employer/role from the next row. The same 970-source projection remains 707 sources / 2,071 rows, 263 unresolved. Original-source review and release gates remain pending (NO_GO).

> Latest source batch: [v97 labelled employer/client ledger](precision-v97-labelled-client-employer-20260923.md). Read-only 970-source re-projection yields 707 sources / 2,071 employment rows, 263 unresolved; 22 added rows retain Company as employer and Client as project context. Original-source review and production gates remain outstanding (NO_GO).

> Latest source-owned quality checkpoint: [v96 career row ownership](precision-v96-source-ownership-quality-20260923.md). The same 970 stored texts re-project to 705 sources / 2,049 employment rows; four incorrect/duplicate rows removed and two non-SAP titles bounded. This read-only result does not replace original-CV review, backfill/readback, live OCR or authenticated exact-artifact acceptance. Production remains NO_GO.

> Latest calculation checkpoint: [v95 SAP Sales and Distribution consulting](precision-v95-sap-sd-experience-20260923.md). Full 970-source read-only projection preserves every employment tuple while correcting one SAP duration classification. Production remains NO_GO pending reviewed originals/backfill, live OCR and exact-artifact acceptance.

> Latest checkpoint: [v94 career field boundaries](precision-v94-career-field-boundaries-20260923.md). Same private 970-source read-only comparison corrects 45 employer/title tuples on 38 sources while keeping every source date, current flag and total row count. Projection remains 705 sources / 2,053 employment rows; 265 sources need review. Malformed, duplicate and invalid-range diagnostics remain zero; overlap and employer/client review flags are unchanged. An earlier over-broad experiment was rejected after it created unreviewed rows. Local mandatory regressions and typecheck pass; exact-head CI, reviewed backfill/readback, live OCR and authenticated acceptance remain required. Production is NO_GO.

> Latest correction: [v93 piped career row ownership](precision-v93-piped-row-ownership-20260923.md). Re-projection of the same private 970-source snapshot preserves all 2,042 v90 employment tuples, adds 11 source-owned rows across three sources, and reaches 705 sources / 2,053 rows. The earlier v91 706/2,065 and repaired-head 706/2,060 projections are superseded because of borrowed titles, reversed columns or location-as-employer rows. The remaining 265 sources are grouped for review; zero malformed/duplicate/invalid-range diagnostics. This is read-only code verification. Reviewed backfill/readback, live OCR and authenticated acceptance on the exact artifact remain required; production is NO_GO.

> Latest checkpoint: [v91 piped employment ownership and candidate API security](precision-v91-piped-employment-security-20260918.md). A bounded `title | employer | period` reader initially projected 706/970 sources and 2,065 rows, but full regression found cross-row date borrowing. The repair preserves explicit date-first overlaps without assigning a following row's period; the projection must be regenerated before use as post-repair evidence. Candidate detail, search, legacy-data and validation endpoints now use recruiter authorization. Local related regressions and typecheck pass; exact-head CI, reviewed backfill/readback, deployed OCR and authenticated acceptance remain required. Production is NO_GO.

> Latest checkpoint: [v88 explicit employer field families](precision-explicit-employer-fields-v88-20260916.md). Full comparison on the reviewed post-backfill 970-source snapshot recovers 12 rows across nine previously empty sources and one populated source, preserves all 2,010 v87 tuples and reaches 700 sources / 2,022 rows. There are 270 sources without extracted employment. Malformed/duplicate/invalid-range counts remain zero; overlap and client/employer flags are unchanged. This is code-only; production remains NO_GO.

> Previous checkpoint: [v87 employer promotion and contract spells](precision-employer-promotion-spells-20260916.md). Full 970-source comparison recovered 13 rows on four previously empty sources, preserved all 1,997 prior tuples and reached 691 sources / 2,010 rows. Audit flags were unchanged. The verified seven-original backfill remained the latest database write.

> Latest code batch: [v85 labelled career records](precision-labelled-career-records-20260916.md). Full read-only comparison of 970 sources: eight previously empty sources recover 23 rows, and one existing truncated title is corrected. Current projection: 677 sources / 1,928 rows; 293 sources remain unresolved. All 1,904 other prior tuples are unchanged. Malformed/duplicate/invalid-range counts remain zero, overlap flags 55 and client/employer equality flags two. No new database write; production remains NO_GO.

> Previous correction: [v84 career row ownership correction](precision-career-row-ownership-20260916.md). Source review found cross-row date/title joins and project clients in v83 output despite green CI. The corrected read-only 970-source projection is 669 sources / 1,905 rows; 301 sources require review. Across 18 changed sources, 39 unsafe or superseded tuples are removed and five corrected/source-owned tuples added. Overlap flags fall from 60 to 55. Earlier v83 recovery/overlap claims are superseded as accuracy evidence. No new database write; production remains NO_GO.

> Historical code batch: [v82 interleaved career records](precision-interleaved-career-batch-20260916.md). All 970 sources compared: 27 previously empty sources recover 61 employment rows; all 1,796 prior tuples remain unchanged. Local totals: 650 sources / 1,857 rows, with 320 sources unresolved. Malformed, duplicate and invalid-range counts remain zero; overlap flags remain 55 and client/employer equality flags remain two. Plural project-section boundaries now prevent project dates from leaking into employment. No additional production data write.

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

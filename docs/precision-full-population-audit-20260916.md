# Full-population source audit and reviewed backfill checkpoint

> Subsequent code checkpoint: [exported career history batch](precision-career-export-batch-20260916.md). v76 locally reads 486 records / 1,491 rows from the same 970-source snapshot, leaving 484 unresolved. This is a parser result; the nine-original production backfill documented below is the last database write.

## Current status

On 2026-09-16 the recruiter explicitly expanded the earlier GitHub-only scope to request the remaining 693-source audit, database backfill and verification, then confirmed the sensitive nine-CV payload and production destination. A private snapshot of all **970 candidate source records** was retained before writing. The reviewed backfill is now **APPLIED AND READBACK VERIFIED**: nine candidates and their nine search-index rows were updated atomically. The other 961 candidate records retain their exact pre-write fingerprint.

The automated source audit now covers **970/970 records; zero remain unaudited at this level**. This does not mean that 970 original documents or complete employment histories have been manually verified. All records contain source text; none has a populated original-file reference.

## Audit results

| Scope | Source records | Records with employment | Employment rows | Records without extracted employment |
| --- | ---: | ---: | ---: | ---: |
| Previous private review subset | 277 | 176 | 627 | 101 |
| Previously unaudited sources | 693 | 229 | 603 | 464 |
| Complete population before backfill | 970 | 405 | 1,230 | 565 |
| Complete population after verified backfill | 970 | 412 | 1,267 | 558 |

Post-backfill malformed employment, duplicate rows and invalid date ranges: **0**. All 1,267 rows have an employer; 1,195 have a title and 1,244 have a complete date range. A fresh full audit records 38 overlapping-history review flags (previously 37), two possible client/employer equality flags (unchanged), 156 projects, 15 without project type and no pagination leaks. The additional overlap is an explicitly labelled freelance role concurrent with another role in the reviewed source; it is retained rather than silently dropping source history. These flags are review signals, not proven errors.

Before restoration, the v75 policy change preserved all 1,230 source employment tuples relative to v74. The unchanged database source texts produced no SAP-duration differences in that comparison; policy regressions separately cover same-employer gaps and distinct employment spells. Original-file restoration and actual persisted results are recorded below.

## Entire unresolved population grouped before further parser changes

| Review group | Records | Next evidence needed |
| --- | ---: | --- |
| Employment heading / unsupported layout | 224 | Seven of the previous 231 sources were recovered by verified original restoration. Review remaining field ownership and date boundaries before expanding rules. |
| Project/client-heavy | 103 | Establish actual employer and role ownership; client similarity alone is insufficient. |
| Explicit company/employer fields | 11 | Review bounded labelled fields and missing or ambiguous tenure. |
| Non-SAP education-oriented sources | 20 | Determine student/non-SAP history from source; do not infer SAP work. |
| Other source review | 200 | Distinguish CV content, summaries, templates, unrelated documents and unsupported layouts. |

These deterministic triage groups are not final diagnoses, unique-person counts or assertions that every record should contain employment. Identifying metadata and source text remain in private review artifacts.

## Recruiter SAP-duration correction

`candidate-employment-v75-continuous-sap-tenure` counts a continuous SAP period from the earliest to latest qualifying project at the same explicitly owned employer, including internal time between those projects. Overlap counts once. Known separate employment spells are not bridged, and matching a client or title does not establish employer ownership. Source employment dates remain unchanged; project-derived tenure remains labelled as an estimate.

Accounting, general sales, end-user and other operational work remain excluded. A SAP keyword alone does not establish delivery work. Explicit module-consultant titles qualify, and SAP associate and SAP Sales and Distribution consulting remain eligible. The original-file review includes a procurement-operations title whose SAP mention must not inflate delivery experience.

## Reviewed-original backfill applied and verified

Nine distinct supplied original PDFs match nine database source records. One duplicate attachment was deduplicated; matching is supported by unique content correspondence and review of layout, ligature, split-character and page-header differences, not just names. Actual production readback now confirms **2 to 39 employment rows** across these nine records: 37 additional rows and seven records previously without employment.

A private pre-write backup contains the 970 source records, the nine existing search-index rows, source-version guards and the reviewed patches. All nine candidate and index fingerprints matched at execution. One atomic transaction updated source text, its normalized hash, provenance, canonical projection and search index together. CV version, candidate IDs, contacts, recruiter fields and all unpatched candidate fields were verified unchanged.

The earlier automatic approval block was resolved by the recruiter's explicit destination-specific confirmation. The first execution failed atomically on 14 PDF NUL characters; no partial writes occurred. Rebuilding the payload with the application's existing source sanitizer removed those controls while retaining line/tab boundaries. All 39 employment tuples and SAP-duration values remained identical to the reviewed plan before retry.

Fresh readback verified 315 planned candidate/index fields, all canonical employment tuples, SAP-duration values and generated search vectors. The population remains 970; the other 961 candidate records have an unchanged aggregate fingerprint. A post-write full-population audit used the nine actual readback records and the fingerprint-verified remaining snapshot. It confirms 412 records with employment, 1,267 rows and 558 unresolved records, with zero malformed, duplicate or invalid-range rows. Private readback data, guards, the pre-write backup and verification scripts are retained outside GitHub. Native extraction provenance explicitly states `live_ocr: false`.

## Verification and remaining release gates

The v75 code passed 33 source/parser/acceptance/consistency regression files and TypeScript checks; focused policy tests also passed. This documentation-only checkpoint records actual backfill readback, the repeated complete-population audit and source-backed overlap review. All evidence is retained privately. Exact-commit GitHub CI must pass before merge.

Production remains **NO_GO**. This nine-original backfill and the automated 970-source audit are complete; outstanding work includes review of the remaining 558 sources, any further evidence-backed backfill, real Google OCR with persisted provenance, and authenticated acceptance against the exact artifact to promote. Vercel project access was last denied, so build/preview statuses cannot establish runtime acceptance. Earlier documents' references to 693 unaudited records, an unexecuted nine-source backfill and a no-gap SAP policy are historical and superseded by this checkpoint.

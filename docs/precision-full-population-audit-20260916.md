# Full-population source audit and reviewed backfill checkpoint

## Current status

On 2026-09-16 the recruiter explicitly expanded the earlier GitHub-only scope to request the remaining 693-source audit, database backfill and verification. A private snapshot of all **970 candidate source records** was retrieved from the connected production project. The population fingerprint was identical before and after extraction and again after backfill planning. No candidate or search-index records were changed.

The automated source audit now covers **970/970 records; zero remain unaudited at this level**. This does not mean that 970 original documents or complete employment histories have been manually verified. All records contain source text; none has a populated original-file reference.

## Audit results

| Scope | Source records | Records with employment | Employment rows | Records without extracted employment |
| --- | ---: | ---: | ---: | ---: |
| Previous private review subset | 277 | 176 | 627 | 101 |
| Previously unaudited sources | 693 | 229 | 603 | 464 |
| Complete population | 970 | 405 | 1,230 | 565 |

Malformed employment, duplicate rows and invalid date ranges: **0**. All 1,230 rows have an employer; 1,157 have a title and 1,215 have a complete date range. There are 37 overlapping-history review flags and two possible client/employer equality flags. These are review signals, not proven errors. The audit also finds 156 projects, including 15 without project type, and no pagination leaks in project responsibilities.

The v75 policy change preserves all 1,230 source employment tuples relative to v74. The unchanged database source texts produce no SAP-duration differences in that comparison; policy regressions separately cover same-employer gaps and distinct employment spells. Original-file restoration is a separate proposed change below.

## Entire unresolved population grouped before further parser changes

| Review group | Records | Next evidence needed |
| --- | ---: | --- |
| Employment heading / unsupported layout | 231 | Review field ownership and date boundaries in the stored source; restore available original layout before expanding rules. |
| Project/client-heavy | 103 | Establish actual employer and role ownership; client similarity alone is insufficient. |
| Explicit company/employer fields | 11 | Review bounded labelled fields and missing or ambiguous tenure. |
| Non-SAP education-oriented sources | 20 | Determine student/non-SAP history from source; do not infer SAP work. |
| Other source review | 200 | Distinguish CV content, summaries, templates, unrelated documents and unsupported layouts. |

These deterministic triage groups are not final diagnoses, unique-person counts or assertions that every record should contain employment. Identifying metadata and source text remain in private review artifacts.

## Recruiter SAP-duration correction

`candidate-employment-v75-continuous-sap-tenure` counts a continuous SAP period from the earliest to latest qualifying project at the same explicitly owned employer, including internal time between those projects. Overlap counts once. Known separate employment spells are not bridged, and matching a client or title does not establish employer ownership. Source employment dates remain unchanged; project-derived tenure remains labelled as an estimate.

Accounting, general sales, end-user and other operational work remain excluded. A SAP keyword alone does not establish delivery work. Explicit module-consultant titles qualify, and SAP associate and SAP Sales and Distribution consulting remain eligible. The original-file review includes a procurement-operations title whose SAP mention must not inflate delivery experience.

## Reviewed-original backfill prepared, not applied

Nine distinct supplied original PDFs match nine current database source records. One duplicate attachment was deduplicated; matching is supported by unique content correspondence and review of layout, ligature, split-character and page-header differences, not just names. The reviewed original cohort would increase from **2 to 39 employment rows** across these nine records, including seven records previously without employment. This is a dry-run result and must not be added to the live population counts above.

A private pre-write backup contains the 970 source records, the nine existing search-index rows, source-version guards and the proposed patches. The intended transaction updates source text, its normalized hash, provenance, canonical projection and search index together. It retains CV version, recruiter fields, candidate IDs and unrelated metadata; all nine candidate and index fingerprints must still match before any write.

**Automatic approval review rejected even the non-executing EXPLAIN payload**, because it contained private CVs, contact details and identifiers and required destination-specific authorization. The target was subsequently corroborated by connected-project inventory and the repository's production-project configuration, but review still rejected the sensitive payload. No indirect retry, database mutation, schema change or permission relaxation was performed. Resume this prepared backfill only after the required explicit confirmation is supplied and freshness guards are rechecked. Do not report the proposed 39 rows as persisted.

## Verification and remaining release gates

33 source/parser/acceptance/consistency regression files and TypeScript checks pass locally; the final focused policy tests also pass. The complete-population audit and reviewed-original dry run are retained privately. Exact-commit GitHub CI must pass before merge.

Production remains **NO_GO**. Outstanding work includes unresolved source review, applying and reading back the reviewed backfill, real Google OCR with persisted provenance, and authenticated acceptance against the exact artifact to promote. Vercel project access currently returns a permission error, so build/preview statuses cannot establish runtime acceptance. Earlier documents' references to 693 unaudited records and to a no-gap SAP policy are historical and superseded by this checkpoint.

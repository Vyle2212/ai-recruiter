# Delimited employment recovery batch — 2026-09-16

## Scope and selection

Parser `candidate-employment-v79-delimited-employment-batch` continues from `babb9fe4f281aa7152504f50e035405a38813126`. The batch compares all 970 stored sources against v78 on the same snapshot after the verified nine-original backfill. It adds no production data writes, OCR calls or runtime configuration.

All 440 unresolved sources were screened before editing. The mutually exclusive first-heading screening buckets were 30 pipe/bracket boundaries, 13 named role/period fields, 155 other dated headings and 242 without a dated heading. These are layout signals, not proof of recoverable employment. The existing review queue contained 201 heading/layout, 82 project/client-heavy, 10 explicit fields, 17 non-SAP/education-oriented and 130 other-review sources.

The reader now handles explicit pipe, bracket and spaced dash field pairs; employer/position/period forms; dated legal-company headings; and consecutive employment ledgers. It starts at a career heading, advances only across accepted adjacent records and stops at duties or project/education sections. It does not resynchronize through unlabelled project prose. Roles, legal employer boundaries, balanced parentheses and complete source-owned date ranges are validated. Numeric dates retain the existing normalization; ordinal dates retain their source precision. Location fragments and client/payroll ambiguity are rejected.

Two data issues found in the actual-source comparison are addressed in this batch:

- A second spelling of an employer with the same role and tenure must not duplicate an existing explicit Period/Company/Designation record. The labelled record retains ownership; the source remains available for review.
- A legal company suffix alone can be replaced by the full employer only when a bounded heading contains the original excerpt and matches its title and date endpoints. Narrative duty suffixes may similarly be trimmed from the same heading's title. Neither operation changes source dates or invents an employer alias.

## Full-population comparison

| Metric | v78 | v79 |
| --- | ---: | ---: |
| Audited source records | 970 | 970 |
| Records with employment | 530 | 557 |
| Employment rows | 1,602 | 1,637 |
| Records without employment | 440 | 413 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Overlap review flags | 54 | 55 |
| Possible client/employer equality flags | 2 | 2 |

Twenty-seven previously empty sources recover 33 rows; two populated sources gain one row each. One prior row's employer is corrected from a suffix fragment to its full source-stated company. All other 1,601 prior company/title/start/end/current tuples remain intact. These are source-record counts, not unique people or claims that every history is complete.

The additional overlap flag is grounded in one source that explicitly lists three roles at the same employer with different start years and current endpoints. All three claims remain flagged; no promotion end dates are inferred. The competing-employer spelling does not add an overlap flag. Two other suffix-fragment rows in a partially recovered history still require review; the batch does not claim that the entire history is repaired.

Employment extraction is not SAP qualification. Sales, finance, recruitment, non-SAP ERP and other unrelated roles can appear in employment without increasing SAP years. The existing recruiter-approved policy remains continuous SAP periods from the first to last qualifying project at the same explicitly owned employer, including internal time between projects, without double-counting overlaps or bridging known separate employment spells. Project-derived estimates remain labelled separately from source dates.

## Remaining queue

| Review group | Before | Remaining | Reason for continued review |
| --- | ---: | ---: | --- |
| Employment-heading/layout | 201 | 188 | Interleaved or incomplete fields and unclear company/title boundaries |
| Project/client-heavy | 82 | 79 | Project dates and client names do not establish employer ownership |
| Explicit fields | 10 | 10 | Incomplete, contaminated or nested labels |
| Non-SAP/education-oriented | 17 | 13 | Employment may be absent or unrelated to SAP |
| Other source review | 130 | 123 | Sparse, non-CV or ambiguous text |
| Total | 440 | 413 | Not every source necessarily contains recoverable employment |

Private source comparisons and review metadata remain outside the public repository. Only synthetic representative and negative examples are committed. No additional original CV is requested by this batch.

## Validation and release

Thirty local employment, source-layout, date, OCR and search regression files pass, including the new delimited employment suite wired into mandatory CI. TypeScript, scoped/new-file formatting and whitespace checks pass. Both the comparison and source audit process all 970 records. Exact-commit CI remains required before merge.

These figures are local projections, not a new database backfill. The verified nine-original transaction and search-index readback remain the last persisted data change. Production remains **NO_GO** pending remaining source review, further reviewed backfill/readback, live Google OCR with persisted provenance and authenticated acceptance on the exact deployable artifact. Build and preview success do not satisfy those gates.

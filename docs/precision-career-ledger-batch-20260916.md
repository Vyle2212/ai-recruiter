# Precision career-ledger batch — 2026-09-16

> Superseded by the [v84 ownership correction](precision-career-row-ownership-20260916.md). The counts below are historical parser output, not accuracy evidence: source review found cross-row joins and client promotion that the structural diagnostics missed.

## Outcome

Parser `candidate-employment-v83-career-ledger-batch` was compared read-only with v82 across all 970 stored sources. It recovers 24 previously empty sources and 82 employment rows. The aggregate result is 674 sources with employment and 1,939 employment rows; 296 sources still require source review. All 1,857 v82 tuples remain present.

The batch handles bounded career ledgers with date/role/legal-employer ordering, role/date/legal-employer ordering, explicit company cards with `Job Title`, service/designation cards, recruitment-system rows, and SAP role/employer/specialisation rows. A module, product, project or client after an SAP role is not accepted as the employer. Project sections cannot resynchronise these readers.

Synthetic positive and negative fixtures contain no candidate data. The negative cases cover project/client headings, reversed ranges, product specialisations without an employer, and system-generated rows with invalid chronology.

## Complete-source comparison

| Metric                                  |   v82 |   v83 |          Change |
| --------------------------------------- | ----: | ----: | --------------: |
| Sources with employment                 |   650 |   674 |             +24 |
| Employment rows                         | 1,857 | 1,939 |             +82 |
| Sources without employment              |   320 |   296 |             -24 |
| Retained prior tuples                   | 1,857 | 1,857 |       0 removed |
| Malformed narrative rows                |     0 |     0 |               0 |
| Duplicate rows                          |     0 |     0 |               0 |
| Invalid date ranges                     |     0 |     0 |               0 |
| Possible client/employer equality       |     2 |     2 |               0 |
| Profiles with overlapping source ranges |    55 |    60 | +5 review flags |

Correction: the earlier attribution of all five new overlap flags to explicit source ranges was not supported. The v84 ownership fix returns this count to 55. Structural flags alone do not validate semantic ownership.

## Remaining review inventory

The 296 sources without employment are grouped by source structure, without identities or source text:

| Review group                                             | Sources |
| -------------------------------------------------------- | ------: |
| Employment heading/layout requiring source review        |     136 |
| Other source review                                      |      89 |
| Project/client-heavy evidence requiring ownership review |      52 |
| Non-SAP education/student evidence                       |      10 |
| Explicit fields with unsupported ownership/layout        |       9 |

These counts are a review queue, not a claim that every source contains recoverable employment. Broad guessing would risk turning clients, projects, products or education into employers. Further recovery requires source-supported ownership or reviewed original/OCR evidence.

## Release status

No candidate row, search index, runtime configuration or deployment was changed. Production remains `NO_GO` until the recovered v83 batch is reviewed and backfilled with readback evidence, live OCR/provenance is verified, and authenticated acceptance passes on the exact artifact proposed for promotion.

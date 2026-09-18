# Career row ownership correction — 2026-09-16

## Outcome and correction to the previous checkpoint

`candidate-employment-v84-career-row-ownership` corrects a systematic error found while reviewing the v83 additions against the private sources. An interior date/title/legal-company match could borrow fields from an adjacent employment row or promote a project client to employer. The earlier zero malformed/duplicate/invalid-range counts did not detect semantic ownership errors. The v83 recovery count and its claim that all five additional overlap flags were explicit source overlaps must not be used as accuracy evidence.

This batch constrains ambiguous readers to a section start, a narrative sentence boundary, a contiguous already-owned ledger row, or a bounded city/numbered-duty heading. Corporate-suffix punctuation is not a sentence boundary. Recognized column tables cannot be reread through an earlier generic Experience heading; project-history headings stop the reader even without a colon. An explicitly headed positions ledger now reads each title after its own employer within the same date-delimited row. Roman title levels stay in the title, and normalized lowercase month names retain month precision.

The original source records are unchanged. Some unsupported or ambiguous projections are withheld; this is not deletion of CV history. In particular, a role/date/company row with intervening subsidiary annotations and a scrambled source with career content mixed into references still need a source-supported reader or original-layout review. They are not declared corrected or complete.

## Full 970-source comparison

| Metric                                     |       v83 |       v84 |
| ------------------------------------------ | --------: | --------: |
| Sources with employment                    |       674 |       669 |
| Employment rows                            |     1,939 |     1,905 |
| Sources without employment                 |       296 |       301 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Profiles with overlap review flags         |        60 |        55 |
| Possible client/employer equality flags    |         2 |         2 |

Across 18 changed sources, 1,900 exact prior company/title/start/end/current tuples remain, 39 unsafe or superseded tuples are removed from the projection, and five corrected/source-owned tuples are added. These include title-level and month-precision corrections and the labelled positions ledger. Five previously nonempty sources return to the review queue. No newly empty source is counted as a successful recovery. Totals are parser projections, not reviewed database results.

## Remaining queue and next work

All 296 previously unresolved sources were classified before this batch. Reviewing concrete ownership errors took priority over widening recall. After the correction, the complete unresolved inventory is:

| Group                                   | Sources | Required evidence/work                                                           |
| --------------------------------------- | ------: | -------------------------------------------------------------------------------- |
| Employment heading/layout               |     138 | Preserve explicit row ownership; source-led fixtures for remaining table layouts |
| Other source review                     |      90 | Resolve scrambled or insufficient text using available originals; do not guess   |
| Project/client-heavy                    |      54 | Establish employer ownership independently of project names and dates            |
| Non-SAP education/student               |      10 | Confirm absence of professional history; do not manufacture SAP employment       |
| Explicit fields with unsupported layout |       9 | Bound field ownership before further extraction                                  |
| Total                                   |     301 | Automated inventory is not complete semantic acceptance                          |

Private before/after tuple differences and review reasons remain outside the repository. No identities, source identifiers, CV excerpts or contact data are committed. Existing attached originals should be reused before requesting another copy.

## Validation and release

Twenty mandatory source/layout/date/OCR suites, three canonical/Search V2 suites and TypeScript checks pass locally. The expanded career-ledger suite asserts complete output tuples, not merely that one expected row exists. Its nested-table regression fails on v83 and passes on v84. Negative cases cover adjacent-company/date ownership, project clients, unpunctuated project headings and invalid chronology; positive cases cover owned ledgers, numbered duties, Roman title levels and numeric-month normalization. The existing mandatory CI job executes this suite.

Exact-head CI/status verification follows publication; prior v83 CI success is not v84 validation. No runtime setting, candidate row, search index or deployment is changed by this batch. The documented nine-original backfill remains the last verified database write. Production stays **NO_GO** pending semantic source review, reviewed backfill/readback of newer output, live OCR with saved provenance, and authenticated acceptance on the exact artifact proposed for promotion. SAP experience policy is unchanged: continuous first-to-last qualifying project span within the same explicitly owned employment spell, including internal gaps, with overlaps counted once and non-SAP work excluded.

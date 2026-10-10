# Whole-corpus parser audit: v212

On 10 October 2026, the same recovered collection of 892 unique originals was processed twice: before and after the professional-position ledger fix. The collection contains 535 PDF, 189 DOCX, 167 DOC and one RTF. These originals are not yet mapped one-to-one to the historical 970 database records.

| Automated audit measure                        | Before | After |
| ---------------------------------------------- | -----: | ----: |
| Originals processed                            |    892 |   892 |
| Native source reads                            |    835 |   835 |
| OCR required                                   |     15 |    15 |
| Employment layout unresolved                   |     42 |    42 |
| Source failures                                |      0 |     0 |
| Employment rows                                |   1858 |  1861 |
| Project rows                                   |    968 |   968 |
| Observed employment section omitted/incomplete |    155 |   154 |
| Observed project section omitted/incomplete    |    260 |   260 |
| Observed education section omitted/incomplete  |      6 |     6 |
| Observed contact section omitted/incomplete    |      3 |     3 |
| Observed language section omitted/incomplete   |      3 |     3 |
| Observed SAP module section omitted/incomplete |      2 |     2 |

The explicit List of professional positions ledger retains original row boundaries through the canonical employment reader. It binds only adjacent employer, date range and role lines, stops at references/education/projects and rejects client labels and reversed ranges. A source DOCX was checked against its original document XML; the recovered three employment rows retain the printed ownership and dates. Public fixtures are deidentified.

The 56 cached OCR sources were also checked separately: 31 accepted, six rejected, 19 OCR_REVIEW_REQUIRED. They overlap the recovered collection and must not be added to 892. In accepted/readable OCR results, missed-section signals include eight employment, nine projects, one education and one language. OCR guards are not an accuracy metric.

Remaining native employment-gap groups: seven headed tables, ten explicit employer fields, 53 heading/date boundaries, 94 project/client-heavy sources, two other layouts. These groups are queues for original-source adjudication, not proven parser mistakes. Missing required fields may be genuinely absent in the CV; no employer/client/date or proficiency may be invented to fill them.

There were no database writes, backfills, bulk promotions or launch. Full profile/fact error rates remain unknown without an independently adjudicated source gold set. These counts do not certify below-1% error. Continue broad cohort-level source checks and shared-rule fixes, rerunning the entire collection after changes rather than approving isolated sample successes.

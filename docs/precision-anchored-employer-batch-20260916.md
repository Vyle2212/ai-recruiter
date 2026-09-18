# Anchored employer tenure batch — 2026-09-16

## Scope and selection

Parser `candidate-employment-v77-anchored-employer-tenures` continues from `f83deb6de1de79cd437f16fa6c597163acfd0d24`. This is a code-only comparison on the same 970-source snapshot taken after the verified nine-original backfill. No further database writes, OCR service calls or production deployment are included.

All 484 remaining sources were screened before changes. Existing review queues contained 224 employment-heading/layout, 93 project/client-heavy, 11 explicit-field, 18 non-SAP/education-oriented and 138 other sources. A separate first-heading screen found 132 work-experience, 50 working-experience, 42 professional-experience, 16 employment-history, eight career-summary, six career-history, three professional-background and one company-name heading; 226 lacked those matched labels. These are screening signals, not complete-history assessments.

The selected group has explicit employer tenures anchored directly to employment headings or declared date/company/role tables. The new reader accepts employer-first headings and adjacent date-first ledgers with a SAP role boundary or legal employer suffix. Printed durations are delimiters only. It never scans forward through duties to find another employer, nor uses project dates as employer tenure.

Company/period/role column labels, location-only fragments, project/client sections, detailed assignment history, invalid/incomplete ranges and narrative continuations are rejected. If a later promotion has its own dates, its title is not assigned to the entire company tenure. A fuller existing reader retains ownership of the same source heading, preventing empty or clipped duplicates. Where title boundaries remain ambiguous, employer and explicit tenure are retained without inventing a title.

Review also found two source records whose table role included a person-name footer and spaced page marker. The role now ends at its explicit parenthesized specialization when a pagination footer and repeated table header follow. Original text remains preserved in provenance; no private identity is committed.

## Full-population comparison

| Metric | v76 | v77 |
| --- | ---: | ---: |
| Audited source records | 970 | 970 |
| Records with employment | 486 | 504 |
| Employment rows | 1,491 | 1,524 |
| Records without employment | 484 | 466 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Overlap review flags | 53 | 53 |
| Possible client/employer equality flags | 2 | 2 |

Eighteen previously empty sources recover 31 rows; two already populated sources gain one row each and have one footer-contaminated title corrected each. Across 20 changed projections there are 35 added tuples and two replaced tuples, a net gain of 33 rows. The two replacements preserve employer, start, end and current status; only footer contamination is removed from the title. All other prior tuples remain intact. These figures count source records, not deduplicated people or complete CVs.

Eight of the 33 additional rows retain an unassigned title. They are grounded employer tenures, not evidence of SAP work. Accounting, therapy, sales and end-user work must not inflate SAP experience. The established continuous same-employer SAP policy, including internal time between projects and overlap counted once, is unchanged.

## Remaining work

The 466 unresolved sources comprise 212 heading/layout, 89 project/client-heavy, 11 explicit-field, 18 non-SAP/education-oriented and 136 other-review records. Remaining headings often have columns interleaved with sidebars, unclear employer/title boundaries, or project-only dates; some are non-SAP or non-CV content. Do not turn this queue into unsupported employment facts or request originals already accessible. Further source review must identify grounded groups before another parser batch or reviewed backfill.

## Validation and release

Twenty-eight employment, source-layout, date, OCR and search regression files pass locally. The new mandatory CI regression includes adjacent ledgers, legal suffix ownership, printed-duration isolation, promotion-date isolation, preserved fuller titles, footer contamination and negative project/client/table/location cases. TypeScript and formatting checks pass locally; exact-commit CI is required before merge.

The new counts are local parser projections, not an additional production backfill. The last persisted candidate/index mutation remains the verified nine-original transaction. Production remains **NO_GO** pending remaining source review, any further reviewed backfill and readback, live Google OCR with persisted provenance, and authenticated acceptance on the exact deployable artifact. Preview/build success is not acceptance.

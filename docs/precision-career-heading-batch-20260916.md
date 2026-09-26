# Career heading and table recovery batch — 2026-09-16

## Scope and selection

Parser `candidate-employment-v80-career-heading-batch` continues from `6fe3c24b4c4cfb48359af1453fa88ecff6c3b637`. This batch compares all 970 stored sources on the unchanged snapshot after the verified nine-original backfill. It performs no additional database writes, live OCR calls or runtime configuration.

Before implementation, all 413 unresolved sources were screened. Mutually exclusive first-heading buckets were 25 labelled-field layouts, 160 dated headings, 191 undated headings and 37 sources without a career heading; 16 sources had no year anywhere in their text. A heading or year is only a screening signal, not proof of employment. Existing review groups were 188 heading/layout, 79 project/client-heavy, 10 explicit fields, 13 non-SAP/education-oriented and 123 other-review records.

The batch addresses repeated source layouts together:

- Comma-separated, role-before-employer and date-before-role headings, including fullwidth punctuation, ordinal days and explicit year/month order.
- Export cards whose role, contract qualifier and company have lost their separating whitespace. Industry/Specialization/Role/Position Level labels establish the card schema; printed duration does not create dates.
- Role/Company/Duration tables, numbered Organization/Designation/From/To tables and Start/End/Title/Company/Notes tables. The notes column remains separate from the employer, title and employment dates.
- Adjacent legal-employer histories with dotted suffixes, including employer-only tenure where no role is stated, and labelled Company/Position/Duration forms before duty headings.

No candidate or employer dictionaries are used. Company/title boundaries reject module fragments, rank prefixes, nested career headings, and possible second legal organizations after commas. A legal suffix immediately after a comma remains part of one company. More explicit labelled employer histories retain ownership over conflicting headings with the same dates. Unlabelled duty/project prose does not restart a heading reader.

The complete dated heading repairs the two remaining suffix-only employer fragments recorded in the v79 checkpoint. Titles and dates on those rows are preserved. A trailing team-description field is excluded from a bounded title. No source date is inferred or silently repaired.

## Full-population comparison

| Metric | v79 | v80 |
| --- | ---: | ---: |
| Audited source records | 970 | 970 |
| Records with employment | 557 | 590 |
| Employment rows | 1,637 | 1,719 |
| Records without employment | 413 | 380 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Overlap review flags | 55 | 55 |
| Possible client/employer equality flags | 2 | 2 |

Thirty-three previously empty sources recover 80 rows. Two populated sources gain one row each. Two prior employer fragments are replaced by the full source-stated names; all other 1,635 prior company/title/start/end/current tuples remain unchanged. No prior row is dropped. These are source-record counts, not unique people or assertions that every CV is fully recovered.

Recovery includes non-SAP employment. Collections, accounting, non-SAP ERP and other unrelated roles do not automatically increase SAP years. Three new employer-only tenures keep the role empty. The recruiter-approved continuous same-employer SAP period, including internal time between qualifying projects and counting overlap once, is unchanged. Known separate employment spells are not bridged; project-derived estimates remain labelled separately from source dates.

## Remaining queue and concrete limits

| Review group | Before | Remaining | Reason for review |
| --- | ---: | ---: | --- |
| Employment-heading/layout | 188 | 171 | Flattened/interleaved columns, unclear boundaries or incomplete dates |
| Project/client-heavy | 79 | 74 | Client/project evidence does not establish legal-employer tenure |
| Explicit fields | 10 | 10 | Incomplete or nested fields with unresolved ownership |
| Non-SAP/education-oriented | 13 | 11 | Employment may be absent or irrelevant to SAP |
| Other source review | 123 | 114 | Sparse, non-CV, unlabelled or ambiguous text |
| Total | 413 | 380 | No assumption that every remaining source contains extractable employment |

The existing 55 overlap flags and two client/employer equality flags remain review items. Source-current markers are preserved as source claims, not newly verified current employment. A recovered source may still have unparsed older positions or ambiguous role/module wording. No additional original is requested in this batch; accessible source evidence and private metadata are retained for continuation.

## Validation and release

Thirty-one local employment/source-layout/date/OCR/search regression files pass, including the new career-heading batch suite. Positive fixtures cover the selected source layouts; negative cases cover project/client sections, reversed and incomplete dates, module/rank leakage, conflicting records and non-SAP experience. Existing section-isolation tests remain unchanged. TypeScript, scoped/new-file formatting and whitespace checks pass. The new suite is part of mandatory Production Trust CI; exact-commit CI must pass before merge.

The comparison and audit each process all 970 sources. Private change-by-source evidence, screening buckets and the remaining queue are retained outside the public repository; committed examples are synthetic.

Production remains **NO_GO**. The verified nine-original transaction and search-index readback remain the last persisted data change. Remaining source review, further reviewed backfill/readback, live Google OCR with saved provenance and authenticated acceptance on the exact deployable artifact are still required. Local parser totals and successful builds/previews are not production acceptance.

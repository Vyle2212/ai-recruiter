# Labelled career records and whitespace-loss recovery — 2026-09-16

## Scope and source selection

Parser `candidate-employment-v81-labelled-career-batch` continues from `2dc5d53b7ea6ea17a08ba84bd8936a8745ff9e26`. All 380 unresolved sources were screened before editing. The unchanged snapshot contains all 970 stored sources after the previously verified nine-original backfill. No runtime configuration, live OCR or database write is performed in this batch.

The initial first-occurrence screen produced 15 labelled-field, 78 dated-heading, 252 undated-heading and 35 no-career-heading records. Sixteen records have no calendar year anywhere. These are heuristic signals: generic experience prose can precede the actual career section. Subsequent inspection therefore examined the explicit career headings and record schemas throughout the remaining sources, rather than assuming the first occurrence was the employment section.

The selected families have source-stated field ownership:

- Organization / Duration / Designation / Key Role cards with missing spaces; only the role's camel-case boundaries are decoded, preserving the source employer string.
- Numbered date/company/position/type records, numbered employer records and bracketed role/company/date cards, including multiple records interleaved with project details.
- Numbered Company / From / To / Duration tables and explicit employer summaries. Printed durations do not manufacture endpoints; a current role does not apply retroactively to the whole tenure.
- Start Date / End Date / Job Title forms and heading permutations with role, employer, location and date separators. Apostrophe years and explicit till-date markers are normalized without repairing missing or reversed dates.
- Compact explicit worked-as/for statements and source-stated role vocabulary such as team leader.

These readers require the schema to begin within an employment section. Nested project-only copies cannot initiate them. Duty text does not restart a heading reader. Employer/title boundaries reject field-label leakage, rank words appended to company names and roles qualified by a client relation. A repeated legal-employer sentence with a location suffix is not another job. Established source assertions retain precedence when a second schema repeats the same job.

One existing false employment row came from a consulting-assignment section in a CV that separately states its employers in an employment table. The explicit employer table now takes precedence over that consulting section. The source text is unchanged and remains available for review; no client tenure is promoted to an employer tenure.

## Full-population comparison

| Metric | v80 | v81 |
| --- | ---: | ---: |
| Sources compared | 970 | 970 |
| Records with employment | 590 | 623 |
| Employment rows | 1,719 | 1,796 |
| Records without employment | 380 | 347 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Overlap review flags | 55 | 55 |
| Possible client/employer equality flags | 2 | 2 |

Thirty-three previously empty sources recover 74 rows. Two populated sources gain four source-stated employer rows in total; one prior consulting-client row is removed, giving 77 net additional rows. The other 1,718 prior company/title/start/end/current tuples are unchanged. The remaining existing overlap and equality flags are still review items. Counts refer to source records, not unique people or fully recovered CVs.

Non-SAP employment is retained as career history without automatically increasing SAP experience. Employer-only rows have no invented title. Recruiter-approved continuous SAP periods from the first to last qualifying project within the same explicitly owned employer, including internal time, remain unchanged. Overlap is counted once and known separate employment spells are not bridged. Project-derived estimates remain distinct from source dates.

## Remaining review queue

| Group | Before | Remaining | Concrete limit |
| --- | ---: | ---: | --- |
| Employment heading/layout | 171 | 156 | Interleaved columns, unclear role/company boundaries, partial dates or unsupported layouts |
| Project/client-heavy | 74 | 66 | Project history does not by itself identify the legal employer or complete employment tenure |
| Explicit fields | 10 | 10 | Incomplete or nested labels whose ownership still needs review |
| Non-SAP/education-oriented | 11 | 11 | Employment may be absent; source presence is not proof of SAP experience |
| Other source review | 114 | 104 | Sparse, non-CV, missing-whitespace, multilingual or ambiguous narrative text |
| Total | 380 | 347 | Review queues, not 347 confirmed parser defects |

The private queue retains real source metadata and the unchanged snapshot. No additional original is requested merely because extraction is empty. Accessible originals must be checked before requesting a replacement. Further source review is still needed; this batch does not claim every remaining layout is impossible to recover in code.

## Validation and release

All 32 local employment/source-layout/date/OCR/search regression files, TypeScript, scoped formatting and whitespace checks pass. The new synthetic suite covers the source families and negative project/client, incomplete/reversed date, rank leakage, duplicate-location and non-SAP cases; it is mandatory in Production Trust CI. Existing regression expectations were not relaxed. All 970 sources were compared and audited after the final change. Exact-commit CI is required before merge.

Public fixtures and this checkpoint contain no real CV text, candidate names, contact details or source identifiers. Private comparison, screening, audit and remaining-queue evidence are retained separately.

Production remains **NO_GO**. This batch is a local parser projection, not a new backfill. The previously verified nine-original transaction and search-index readback remain the last persisted data change. Remaining source review, further reviewed backfill/readback, live Google OCR with persisted provenance and authenticated acceptance on the exact deployable artifact remain required. Successful builds and preview deployments are not acceptance.

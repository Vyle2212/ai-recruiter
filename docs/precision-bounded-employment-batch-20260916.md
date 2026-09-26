# Bounded employment recovery batch — 2026-09-16

## Scope and source selection

Parser `candidate-employment-v78-bounded-employment-batch` continues from `883efb9e04fc1ec01902dd9565a5dd85fd0bf2ed`. This is a code-only comparison on the same 970-source snapshot after the verified nine-original backfill. It performs no additional database writes, OCR service calls or deployment.

All 466 unresolved sources were screened before implementation. The existing review groups were 212 employment-heading/layout, 89 project/client-heavy, 11 explicit fields, 18 non-SAP/education-oriented and 136 other-review records. Every remaining stored text had lost line breaks. Four short sources were empty templates or a brief invitation to ask for information, with no source-file reference; these cannot yield grounded employment and are not requests for unidentified originals.

The batch targets repeated schemas rather than candidate-specific exceptions:

| Recovered layout | Additional rows |
| --- | ---: |
| Explicit worked/working/employed sentences | 30 |
| Dated title/employer cards with Industry and Role/Position Level schema | 27 |
| Named company, position and duration fields | 9 |
| Bounded role/employer/date headings and adjacent ledgers | 12 |
| Total | 78 |

Employer, role and complete tenure must have a source-owned boundary. Ordinal days, month/day/year punctuation, year-only endpoints and explicit current markers retain their source precision. Printed durations never create dates. Missing endpoints remain missing. Employer-only prose can recover tenure without inventing a role. Generic heading readers require recognizable role starts and stop at duties; company fields reject role/module fragments, payroll ambiguity and nested client/project relations.

Named fields stop before nested projects, retain position rather than project roles, and bound provenance before duties. Adjacent ledgers validate both sides of a company/role boundary, preventing legal employer suffixes from moving into the next title. Existing readers retain ownership of a fuller heading. Competing prose assertions do not override explicit company/position records; a broad repeated employer duration does not replace an existing granular history. Conflicting original text remains available for source review.

## Full-population comparison

| Metric | v77 | v78 |
| --- | ---: | ---: |
| Audited source records | 970 | 970 |
| Records with employment | 504 | 530 |
| Employment rows | 1,524 | 1,602 |
| Records without employment | 466 | 440 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Overlap review flags | 53 | 54 |
| Possible client/employer equality flags | 2 | 2 |

Twenty-six previously empty sources recover 70 rows. Six already populated sources recover eight additional rows. All 1,524 prior company/title/start/end/current tuples remain intact; no prior tuple is removed or replaced. These counts describe source records, not unique people or complete CVs.

The one additional overlap flag comes from two explicitly labelled employers whose original source states the same October 2017–July 2019 range. Both assertions are preserved for review; the parser does not invent a correction or silently suppress the overlap. It is not counted as a clean verified history. Four additional rows have no stated bounded title and cannot automatically count as SAP work.

Employment recovery includes non-SAP history. Accounting, sales, end-user work and other non-SAP roles do not become SAP experience merely because they were parsed. The existing policy of continuous SAP periods at the same explicitly owned employer, including internal time between projects and counting overlap once, remains unchanged.

## Remaining queue

| Review group | Before | Remaining | Why review is still needed |
| --- | ---: | ---: | --- |
| Employment-heading/layout | 212 | 201 | Flattened/interleaved fields, unclear title/company boundaries, or incomplete dates |
| Project/client-heavy | 89 | 82 | Assignment dates and clients do not establish legal employment ownership |
| Explicit fields | 11 | 10 | Labels are incomplete, contaminated or nested in project fields |
| Non-SAP/education-oriented | 18 | 17 | Employment may be absent or unrelated to SAP; do not invent history |
| Other source review | 136 | 130 | Non-CV, sparse, unlabelled or ambiguous text, including four short templates/messages |
| Total | 466 | 440 | Source review remains necessary; not every source has recoverable employment |

Private metadata, source-to-change comparison, review queue and original backup are retained outside the public repository. No original CV, candidate identity, contact, source ID or identifying excerpt is committed. No additional original CV is requested by this batch.

## Validation and release

Twenty-nine local employment, source-layout, date, OCR and search regression files pass, including the new mandatory bounded-reader suite. It covers positive schemas and negative project/client, missing/reversed dates, payroll conflicts, fused roles, location/title fragments, printed-duration isolation, fuller-heading ownership and competing source assertions. TypeScript, scoped formatting and new-file formatting pass. The comparison and source audit each process all 970 records; exact-commit CI must also pass before merge.

These are local parser projections, not an additional production backfill. The last persisted mutation remains the verified nine-original transaction and its search-index readback. Production remains **NO_GO** pending remaining source review, any further reviewed backfill/readback, live Google OCR with persisted provenance, and authenticated acceptance on the exact deployable artifact. Build and preview success are not acceptance.

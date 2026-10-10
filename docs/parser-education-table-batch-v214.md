# v214 qualification/institution education tables

The shared upload enrichment reader previously omitted degree-first two-column
education tables. It now reads explicit Qualification / Institution headers with
newline or tab-separated cells, preserves printed degree and institution values,
and leaves absent graduation years empty. Project, technical skills and reference
headings terminate the education section. Client/employer/project cells cannot
become institutions. This is a shared rule, not a candidate-specific patch.

A representative original DOCX XML table has two degree/institution rows and no
years. Both rows survive prepareCandidateCv for admin_upload and candidate_upload
with identical education payloads. Deidentified tests cover the glued Masterof
spelling, tab cells, absent years and project/client boundaries.

## Validation

All 892 unique originals were audited in four completed 223-file workers using
the v214 functional working-tree patch against the v213 local HEAD. This audit is
not an exact committed-HEAD CI run. The ingestion revision label was advanced
after extraction; it does not change extraction logic.

| Measure                              | v213 | v214 |
| ------------------------------------ | ---: | ---: |
| Native sources                       |  835 |  835 |
| Source failures                      |    0 |    0 |
| Complete employment rows             | 1863 | 1863 |
| Project rows                         |  968 |  968 |
| Observed education omission signals  |    6 |    5 |
| Missing required education signals   |  280 |  275 |
| Observed employment omission signals |  153 |  153 |
| Observed project omission signals    |  260 |  260 |

Coverage signals are review queues, not adjudicated factual error counts. Only
one representative original table was independently checked in this batch; the
five-count required-field change must not be described as five verified fixes.

Passed: TypeScript noEmit, nested history tests, ingestion parity, and all 17
production-trust dependency checks. No database writes or deployment were made.
Exact remote-HEAD CI/build remains required before Acceptance deployment.

Launch remains NO_GO. A factual error rate below 1% is unproven. Remaining work
includes five observed education cases, all project layout groups, employment
review queues and supervised OCR/source adjudication. Never invent missing
roles, clients or dates to make a profile pass completeness checks.

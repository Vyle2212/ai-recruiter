# v215 education layouts and partial project ledgers

The full v214 native source cache covers all 892 originals without network OCR.
It is private and remains outside Git. All five observed education omission
cases and all 260 observed project omission cases were collected, with no
sample-count cutoff. Project queues: 87 explicit Project labels, 48 Client
labels, four selected-project ledgers and 121 other layouts (exclusive groups).

## Shared changes

Education now reads explicit field/value cards, flattened Qualification / Field
of Study / Major / Institute-University / Grade / Graduation Date records,
four-label/four-value Word tables, qualification-first school/range pairs, and
adjacent institution plus dated degree lines. Absent years remain absent. No
employment or certification date fills a missing education date. This retains
six education records from all five previously omitted source cases.

Selected project ledgers now retain dated SAP reporting/implementation/track
titles as incomplete drafts when no per-project role is printed. Their own dates
are preserved; Now sets current=true, including simultaneous projects. No role,
client or employer is inferred from shared responsibilities or nearby headings.
These drafts do not pass the existing valid-project/completeness gate. Matching
existing project name and dates prevents duplicates.

The representative original PDF retains three Track records through the real
prepareCandidateCv pipeline, including two concurrent Now records. Missing
role/client/employer remain empty and the profile still needs review. Three
education DOCX XML sources were checked against retained values; the two legacy
DOC/RTF sources were checked against their native extracted fields. This is not
an independently adjudicated population gold set.

## Full native regression

Four workers completed 223 files each using the v215 functional working-tree
patch against the local v214 HEAD. Exact remote committed-head CI is separate.

| Measure                              | v214 | v215 |
| ------------------------------------ | ---: | ---: |
| Unique originals                     |  892 |  892 |
| Native sources                       |  835 |  835 |
| Source failures                      |    0 |    0 |
| Complete employment rows             | 1863 | 1863 |
| Complete project rows                |  968 |  968 |
| Observed education omission signals  |    5 |    0 |
| Missing required education signals   |  275 |  270 |
| Observed project omission signals    |  260 |  260 |
| Observed employment omission signals |  153 |  153 |

The three retained project drafts are deliberately excluded from complete row
counts. Zero observed education omissions does not establish zero factual
education errors. Remaining required education can be absent in the CV and
needs candidate confirmation rather than invented values.

Passed: TypeScript noEmit, deidentified layout/boundary tests, ingestion parity,
and all 17 production-trust dependency checks. No database writes or deployment
were made. Launch remains NO_GO and factual error rate below 1% is unproven.
Next work: all explicit project card layouts, client-first tables, remaining
employment queues, source OCR and independently adjudicated accuracy checks.

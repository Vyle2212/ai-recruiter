# Bounded career field cards — 2026-09-23

## Grouped source review and safe recovery

The same private 970-source snapshot had **236 sources without extracted
employment** under v105. Aggregate screening identified three distinct
field-owned career layouts with sufficient evidence for bounded readers:

| Layout and ownership | Recovered sources | Added rows | Withheld evidence |
| --- | ---: | ---: | --- |
| `Professional Experience: Company / Designation / Client / Duration` | 1 | 1 | Historical `Till Date`, absent legal employer, and unowned client cells |
| `Work` cards with period, `Role:` and `Company:` | 1 | 2 | Historical open end, duplicated source text, project-only cards and organization fields without an employer boundary |
| `Professional Working Experience` with `Company:`, `Duration:` and `Role:` | 1 | 2 | Historical open end and multiple companies asserting the same dates |

All recovered roles have a company, role and closed date range printed in the
same row or card. The first layout separates the Client column from the legal
employer. The last layout keeps `Project:` distinct from the preceding employer
Duration. Repeated periods with competing company assertions remain for
review. De-identified positive and negative regressions cover each family,
missing fields, reversed ranges, client-only cards, competing employers and
duplicated source text; no CV, name or contact information is published.

## Complete read-only comparison

On all 970 records, extraction rises from **734 sources / 2,155 employment
rows** to **737 sources / 2,160 rows**. The five new rows belong to three
previously empty sources. All **2,155** earlier employer/title/start/end/current
tuples remain unchanged. Malformed narrative, duplicate and invalid-range
diagnostics remain zero. Overlap review remains **58** and possible
client/employer equality remains **2**. All projects and estimated tenure
fields stay unchanged. SAP experience changes in only one recovered source
from **2.7** to **3.0** years; the other 969 sources retain their values.

The **233 remaining sources** are heuristic review queues, not proof that all
have employment to recover:

| Review queue | Count | Current barrier |
| --- | ---: | --- |
| Project/client-heavy | 174 | Assignment evidence does not establish payroll employer |
| Near career heading/date | 39 | Company, role or date cells lack an owned boundary |
| Other narrative/layout | 14 | No repeatable employer-role field boundary |
| Short or missing source | 4 | Insufficient text in available snapshot |
| Explicit employer label | 1 | Ownership and source version need adjudication |
| Headed table | 1 | Column ownership remains ambiguous |

This GitHub-only code batch did not write database rows. Production remains
**NO_GO** until reviewed source adjudication, version-matched backfill/readback,
live OCR with persisted provenance, and authenticated acceptance on the exact
promoted artifact are evidenced.

# Owned career spells and project ledgers — 2026-09-23

## Source groups

The same private snapshot contains 970 source records. Before editing, 247
sources had no extracted employment: 179 in a project/client-heavy heuristic
queue, 46 with a date near a career heading, 14 with other narrative/layout
issues, four short or missing, three with explicit employer fields and one
headed table. These queues are review aids, not proof of SAP employment.

Three recurring layouts have enough field ownership for a bounded reader:

- An Employment History card states employer, year/month-to-year/month period,
  role and duty text. Consecutive cards each keep their own employer and dates.
- A numbered project has its own Duration, Client, Employer and Role labels.
  The duration belongs to the project, so the employment row has blank stated
  dates. A separate estimate spans the first through last owned SAP project at
  that employer and includes time between them. A later project's employer
  cannot fill a missing field in the previous project.
- Repeated Company Name and Position Title fields under Work Experience have
  their own trailing From/To field. Each date stays within its company block.
  Year-only dates keep their original precision. An outsourcing customer in
  parentheses is removed from the employer name. Non-SAP service desk roles
  remain in general employment without adding SAP experience.

## Full read-only comparison

On the unchanged 970-source snapshot, employment goes from **723 sources /
2,096 rows** to **726 sources / 2,105 rows**. Three previously unresolved
sources gain nine source-owned rows: three from year/month career cards, one
from an employer-labelled project ledger and five from company/position/date
cards. The project ledger adds two assignment rows and one explicitly labelled
employer-tenure estimate. All **2,096** earlier employer/title/date/current
tuples are unchanged; all other 969 sources' projects and estimates are
unchanged.

One source's explicitly SAP-titled project work gains an estimated 0.8 years,
including the internal interval between the two projects. Another source
gains 13.4 years from its own stated SAP-role periods; its two earlier IT
service desk roles do not contribute SAP experience. The third source has
only non-SAP roles and gains no SAP experience. These are read-only projection
values requiring source review before backfill.

Malformed narrative, duplicate and invalid-range diagnostics remain zero.
Overlap review flags remain 57 and possible client/employer-equality flags
remain two. De-identified positive and negative regressions cover bounded
project fields, next-row isolation, reversed dates, project/company ambiguity,
repeated year/month cards, outsourcing clients, and non-SAP titles. All 32
local regression files, TypeScript typecheck and full-source comparison pass.

The **244 remaining sources** are grouped for review:

| Heuristic review queue | Count | Continuing reason |
| --- | ---: | --- |
| Project/client-heavy | 179 | Assignment or client dates do not establish employer ownership alone |
| Career heading/date | 45 | Missing row boundaries, reading order, ambiguous employer or date |
| Other narrative/layout | 14 | No supported recurring role and employer boundary |
| Short or missing source | 4 | Insufficient text for extraction |
| Explicit employer fields | 1 | Its own role or period remains ambiguous |
| Headed table | 1 | Original column ownership still needs review |

No candidate identity, contact detail, original filename, source excerpt or
private source identifier is published here. This was a code-only read-only
comparison. Production remains **NO_GO** pending reviewed source adjudication,
version-matched backfill/readback, live OCR with persisted provenance and
authenticated acceptance of the exact promoted artifact.

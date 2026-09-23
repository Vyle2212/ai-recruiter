# Bounded repeated career summaries — 2026-09-23

## Source groups and rules

The unchanged private snapshot contains 970 source records. Before editing,
244 sources had no extracted employment: 179 in a project/client-heavy review
queue, 45 with a date near a career heading, 14 with other narrative/layout
issues, four short or missing, one with explicit employer fields and one headed
table. These queues route review; they do not prove SAP employment.

Four recurring layouts provide sufficient row ownership for a bounded reader:

- `WORK SUMMARY` rows each contain employer, role and a parenthesized complete
  period. The next row must begin after the previous closing parenthesis.
- `CAREER PROGRESSION` rows each contain employer, optional location, complete
  period and role. The following employer cannot be absorbed into the role.
- `EXPERIENCES` rows contain role, a legal employer and a parenthesized period.
  Duty prose, clients and project sections are excluded.
- Numbered `PROFESSIONAL BACKGROUND` cards contain employer, Position Title and
  their own Date Joined/Date Left fields. `Joined Since` without an end keeps a
  blank end; it is not converted to Present.

SAP core-user, key-user and super-user titles remain general employment and do
not add SAP delivery experience, including titles that also contain Engineer or
Analyst. SAP consulting and delivery roles continue to use source-supported
periods only.

## Full read-only comparison

On the same 970-source snapshot, employment increases from **726 sources /
2,105 rows** to **730 sources / 2,129 rows**. Four previously unresolved
sources gain 24 source-owned rows. All **2,105** earlier
employer/title/start/end/current tuples are retained.

The four recovered sources gain respectively 3.3, 3.1, 14.0 and 3.9 supported
SAP years. Operational SAP-user work is excluded. A start-only current role
keeps its missing end and adds no unsupported time. Projects and labelled
project-tenure estimates are unchanged on all 970 sources.

Malformed narrative, duplicate and invalid-range diagnostics remain zero.
Overlap review flags remain 57 and possible client/employer-equality flags
remain two. De-identified positive and negative regressions cover every layout,
row isolation, project/client boundaries, missing and reversed endpoints, and
operational SAP-user exclusions. All 33 local regression files, TypeScript
typecheck and the full-source comparison pass.

The **240 remaining sources** are grouped for review:

| Heuristic review queue | Count | Continuing reason |
| --- | ---: | --- |
| Project/client-heavy | 179 | Assignment or client dates do not establish employer ownership alone |
| Career heading/date | 42 | Missing row boundaries, reading order, ambiguous employer or date |
| Other narrative/layout | 14 | No supported recurring role and employer boundary |
| Short or missing source | 4 | Insufficient text for extraction |
| Headed table | 1 | Original column ownership still needs review |

No candidate identity, contact detail, original filename, source excerpt or
private source identifier is published here. This was a code-only read-only
comparison. Production remains **NO_GO** pending reviewed source adjudication,
version-matched backfill/readback, live OCR with persisted provenance and
authenticated acceptance of the exact promoted artifact.

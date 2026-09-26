# Heading-bound career cards — 2026-09-23

## Group and ownership rule

The unchanged private 970-source snapshot was classified before editing. At
the v100 baseline, 256 sources had no extracted employment: 179 were
project/client-heavy, 55 had a date near a career heading but insufficient row
ownership, 14 had other narrative/layout issues, four were short or missing,
three used explicit employer fields that still needed review, and one was a
headed table requiring layout review. These are heuristic queues, not
adjudicated root causes or claims of SAP work.

This batch targets nine sources in the heading/date group. A new fallback reads
only the first career card immediately below a Work, Professional, Employment,
or Career History heading. It accepts recurring source orders such as
employer/role/date, employer/date/role, role/employer/location/date,
employer-descriptor-role/date, and role/date/employer. The card must contain
its own recognized role, complete chronological range, and a duty or labelled
boundary. Location is removed from employer. A legal client entity between an
employer and date is not treated as location, and the entire card remains for
review. Project headings, project/objective prose, reversed ranges, and a date
borrowed from a later row are rejected.

Non-SAP roles remain valid general employment but contribute zero SAP tenure.
Only explicitly SAP-titled roles change SAP experience in this batch. A dated
employment range is continuous employer tenure, so internal time between
projects inside that range is not subtracted. Existing project-envelope
estimates and their gap policy are unchanged.

## Full read-only comparison

The same 970 sources project **714 sources / 2,087 employment rows before** and
**723 sources / 2,096 rows after**. Nine previously empty sources each gain one
source-owned row. Every earlier 2,087 company/title/start/end/current tuple is
retained. All projects and all existing estimated-tenure records are unchanged.
SAP experience changes on exactly three newly recovered profiles with explicit
SAP titles; the six non-SAP titles do not increase SAP experience.

Malformed narrative, duplicate, and invalid-range diagnostics remain zero.
Overlap-review flags remain 57 and possible client/employer-equality flags
remain two. Completeness increases by nine for company, title, and date range;
no partial endpoint was invented.

The **247 remaining sources** are grouped as follows:

| Remaining review queue   | Count | Continuing reason                                                      |
| ------------------------ | ----: | ---------------------------------------------------------------------- |
| Project/client-heavy     |   179 | Employer ownership is not established by assignment/client dates alone |
| Career heading/date      |    46 | Later rows, reading order, or field boundaries remain insufficient     |
| Other narrative/layout   |    14 | No supported recurring card or table boundary is proven                |
| Short or missing source  |     4 | Source text is insufficient for extraction                             |
| Explicit employer fields |     3 | Own role/tenure or assignment ownership remains ambiguous              |
| Headed table             |     1 | Column ownership still requires original-layout review                 |

De-identified tests cover all accepted card orders plus negative client/legal-
entity, project-heading, objective/prose, and inverted-range cases. They also
verify that a non-SAP therapist role remains employment while contributing no
SAP tenure. The mandatory CI suite includes the new regression. The checkpoint
contains no candidate identity, contact detail, source text, filename, or
private source identifier.

This is a read-only code projection, not reviewed backfill or database
readback. Production remains **NO_GO** pending source adjudication and
version-matched backfill/readback, live OCR with persisted provenance, and
authenticated acceptance on the exact artifact to promote. No runtime
configuration, database write, or production promotion occurred.

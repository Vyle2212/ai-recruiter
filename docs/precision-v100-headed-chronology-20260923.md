# Career chronology recovery — 2026-09-23

## Source grouping and rule

An executable read-only classifier examined every source on the unchanged
private 970-source snapshot before editing: 261 lacked extracted employment.
Its heuristic queues were 179 project/client-heavy, 60 near career heading and
date, 14 other narrative/layout, four short/missing, three explicit employer
field, and one headed table. These are screening signals rather than verified
causes or claims of SAP work. The high-evidence subset has a career heading
immediately followed by dated chronological records: uppercase role after an
employer, role followed by a legal employer and separate customer, SAP role
followed by a distinct company and duties, or bracketed day/month/year rows
followed by a SAP role, company and City label.

The reader requires a separate employer and role in each dated row. It stops
at education, references and project sections, refuses reversed dates and
does not borrow a later row's employer. Numeric day/month/year is interpreted
only when another **valid** date in the same career section proves day-first
notation; an isolated ambiguous date remains for review. A company separated
from its customer is retained as employer. Non-SAP titles can be displayed in
general employment history but cannot count as SAP delivery solely because
their tasks or projects mention SAP.

## Full read-only comparison

The same 970 records project **709 sources / 2,075 employment rows before**
and **714 sources / 2,087 rows after**. Five previously empty sources recover
12 dated roles; every earlier 2,075 company/title/start/end/current tuple is
unchanged. Projects on all 970 sources are unchanged. SAP years change only
for three newly extracted profiles with explicitly SAP-titled roles; two
others remain at zero. No added malformed, duplicate or invalid range occurs;
overlap-review flags remain 57 and client/employer-equality flags remain two.
One adjacent role in a recovered career section is withheld because its role
suffix and legal-employer boundary remain ambiguous in the flattened source.
The 256 remaining sources group into 179 project/client-heavy, 55 near career
heading/date, 14 other narrative/layout, four short/missing, three explicit
employer field and one headed table. The high-count project/client queue
still requires adjudicating employer ownership; it is not an invitation to
promote a client to employer.

De-identified positive and negative tests cover four chronology structures,
multiple employers, a separate customer, non-SAP titles, a project section,
education, reversed ranges, invalid calendar dates, and ambiguous numeric
dates. The mandatory CI suite includes the new test. This checkpoint includes
no candidate identities, CV text, original filenames, source IDs or contacts.
The comparison is against a private snapshot and is **not reviewed backfill**.
Production remains **NO_GO** pending reviewed source adjudication and database
readback, live OCR with persisted provenance, and authenticated acceptance of
the exact artifact to promote. No runtime configuration or database write
occurred in this GitHub-only batch.

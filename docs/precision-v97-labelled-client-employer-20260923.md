# Labelled employer and client employment ledgers — 2026-09-23

## Source group and rule

The same private 970-source snapshot was screened before changing the parser.
Two previously unresolved records use repeated `Duration → Client → Company →
Role` rows under a Work Experience heading. In each row the employer is
explicitly labelled `Company`; the separately labelled `Client` remains project
context. The parser reads only complete, valid date ranges owned by that row,
normalizes the source's two-digit years using the existing date pivot, and
keeps current status only when the source says Current/Present/Now or Till Date.
It does not read project-only sections, borrow dates across records, fill an
invalid range or treat a client as an employer. Non-SAP roles can remain in
employment history but do not add to SAP experience. Representative synthetic
positive and negative records are part of mandatory source-layout CI.

## Full-source comparison

Read-only projection of the unchanged 970-source snapshot: **705 sources /
2,049 employment rows before; 707 sources / 2,071 rows after**. The 22
source-owned rows belong to two previously empty sources. All 2,049 prior
tuples are identical, and the other 968 sources have identical timelines.
The two affected SAP experience projections change from unestablished to 7.6
and 7.7 years based on the supported SAP roles; project counts are unchanged.
These are source records, not necessarily distinct people or verified database
writes. Malformed, duplicate and invalid-range diagnostics remain zero.
Overlap review flags change 56 → 57 because an explicit concurrent assignment
is now visible; possible employer/client equality flags remain two and were
separately reviewed against source evidence as legitimate dual relationships.

**263 sources remain without extracted employment**: 180 project/client-heavy
(employer ownership needs review), 60 near a heading/date (layout review),
13 other narrative/layout, five short or missing, four explicit employer-field
review, and one headed-table review. These mutually exclusive heuristic queues
do not establish that every source has qualifying SAP employment.

No CV, candidate identity, source excerpt, contact detail or original filename
is stored in this public checkpoint. No database write, runtime configuration
or promotion occurred. Production remains **NO_GO** until reviewed
backfill/readback, source review, live OCR with saved provenance and
authenticated acceptance on the exact promoted artifact are demonstrated.

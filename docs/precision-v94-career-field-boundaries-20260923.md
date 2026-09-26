# Career field boundaries and legal employer names — 2026-09-23

## Grouped source review

The private 970-source snapshot was re-projected with the same input and
compared against the v93 checkpoint. **38 sources have 45 corrected employment
tuples**: 23 employer-only corrections, 19 title-only corrections and three
corrections to both fields. Each replacement retains its source start/end
dates and current flag. The total remains **705 sources with employment,
2,053 rows; 265 sources without employment extraction**.

The title-before-`at Employer` reader had allowed duty prose and export
footers to become job titles; its employer cleanup could reduce a legal name
to `Bhd.` or `Ltd.`. The correction bounds only suspicious titles to the
adjacent role and restores the complete legal employer from that same row.
Already well-formed role titles retain their SAP qualification and seniority.
Explicit Company/Position and Company Name/Position Title records now stop a
title at another labelled field. A record containing an address plus a
Department field is held for review instead of being treated as a new
employment row. De-identified positive and negative regression cases cover
the reviewed layouts. The employment extractor cache version was advanced so
cached projections are rebuilt on this code revision.

An earlier broad boundary experiment created 18 additional, unreviewed rows.
Those rows were excluded from this release comparison; only replacements
with unchanged source dates remain. Malformed narrative, duplicate and
invalid-range diagnostics remain zero. Overlap flags remain 58 and possible
client/employer conflicts remain two.

## Remaining review groups

Heuristic queues on the same 265 unresolved sources are unchanged: 182
project/client-heavy (employer ownership cannot be assumed), 60 near an
employment heading and a date (layout boundaries need review), 14 other
narrative/layout, four explicit employer labels needing field review, four
short or insufficient source texts and one headed table needing column review.
These queues include sources that may have no qualifying SAP employment.

This is a read-only code batch. No original CV, candidate identity, contact
details or raw source text is in this checkpoint. No database write, live OCR
or authenticated deployment acceptance was performed. Production remains
**NO_GO** until reviewed source/backfill/readback, live OCR and authenticated
acceptance on the exact artifact are evidenced.

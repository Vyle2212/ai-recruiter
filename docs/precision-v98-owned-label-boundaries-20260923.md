# Owned field boundaries for client/employer ledgers — 2026-09-23

## Data-integrity correction

The v97 `Duration → Client → Company → Role` reader could skip a missing
Company field, read the next row's Company and Role, and assign them to the
previous row's dates. Its field boundaries now stop at the next Duration,
Client, Company or Role label. A de-identified missing-Company/valid-next-row
regression asserts that the first row stays unextracted and the second retains
its own employer, title and dates. The project-only and invalid-range negative
cases remain mandatory in CI. Version v98 invalidates any cached projection
made by the weaker reader.

The private 970-source v97 snapshot is re-projected before promotion. The
source set contains no instance of this incomplete-row pattern; output stays
at **707 sources / 2,071 employment rows**, all prior tuples and SAP experience
values remain unchanged, and **263 sources remain unresolved**. Malformed,
duplicate and invalid-range diagnostics remain zero. Overlap review flags
remain 57 and employer/client equality review flags remain two. Review groups
are 180 project/client-heavy, 60 near heading/date, 13 other narrative/layout,
five short or missing, four explicit employer-field, one headed table. This
checkpoint corrects an unsafe parsing boundary; it claims no new recovery.

No private source text, candidate identity or contact detail is committed.
Reviewed source adjudication and backfill/readback, live OCR with saved
provenance, and authenticated acceptance on the exact promoted artifact still
block production (**NO_GO**). No runtime setup or database write occurred.

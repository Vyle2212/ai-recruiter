# Production employment gap inventory — 2026-09-24

## Read-only production baseline

A read-only aggregate query covered all 970 candidate records without returning
candidate IDs, names, contact details, filenames or CV text. The stored
canonical payloads are still on `candidate-parser-v2`:

- 231 sources contain 715 stored employment rows;
- 739 sources have an empty stored employment array;
- all 970 records retain source text usable for controlled re-projection.

This is the current database state, not the latest parser result. The v106
read-only code projection remains 737/970 sources and 2,160 employment rows,
with 233 sources routed for review. Therefore the apparent difference of 506
sources and 1,445 rows is an **unpromoted projection**, not a reviewed or
verified production backfill.

## Complete stored-gap classification

The 739 stored gaps were classified into mutually exclusive heuristic review
queues using layout signals only:

| Review queue                                         | Sources |
| ---------------------------------------------------- | ------: |
| Near heading/date boundary                           |     416 |
| Project/client-heavy; employer evidence still needed |     227 |
| Explicit employer labels needing field review        |      57 |
| Headed tables needing layout review                  |      26 |
| Other narrative/layout review                        |       9 |
| Short or missing usable source                       |       4 |
| **Total**                                            | **739** |

These queues are not employer adjudications. In particular, project/client
mentions cannot be promoted to employer without source-owned evidence, and
missing dates remain missing.

## Repeatable GitHub artifact

`supabase/manual/202609240001_production_employment_gap_inventory.sql` repeats
the audit inside a `REPEATABLE READ READ ONLY` transaction, fails closed if the
canonical employment array is missing, and emits one aggregate JSON document.
Static regression rejects state-changing statements and candidate-identifying
output fields.

## Decision and release status

This evidence changes the next priority: do not add speculative person-specific
regexes against the old stored output. First produce a version-matched,
reviewable backfill plan from the already-tested parser, compare all 970 sources,
then apply only approved changes with backup and readback. The 233 sources still
unresolved after current code projection remain the parser/manual-review target.

No database write, OCR call, candidate export or runtime configuration change
was performed. Production remains **NO_GO** pending reviewed backfill/readback,
live OCR provenance, authenticated exact-artifact acceptance, verified backup,
controlled RLS cutover/readback and advisor verification.

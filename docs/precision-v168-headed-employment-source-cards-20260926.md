# v168 — Bounded employment source cards (2026-09-26)

## Source-backed batch

The shared admin/candidate parser now recognizes three line-bounded layouts under an employment heading: a `Company's name / Position title / Period` card whose six fields are all adjacent; a legal employer followed by one short address line and a role with a printed tenure; and a legal employer with its own parenthesized tenure followed immediately by a position. An intervening project subsection blocks these new rules. The parenthesized form requires a legal company suffix, rejects role-like employer headings and never borrows a later project's dates. Date endpoints pass the shared calendar, future-date and order validation. No missing dates are filled in.

Synthetic positive and negative fixtures cover each form, including a client label, project section, role-like company, reversed range, future date and candidate/admin parser parity. The first private trial exposed role-as-employer rows; that trial was **rejected**, the legal-employer guard was added, and the complete Word population was rechecked before this checkpoint.

## Same-population private audit

The collection fingerprint is identical before and after. Only aggregate results are recorded here; no CV text, identifiers, filenames, contact fields or per-source hashes are serialized.

| Metric, 357 unique Word originals         | Before (v166) | After | Change |
| ----------------------------------------- | ------------: | ----: | -----: |
| Valid employment rows                     |           821 |   831 |    +10 |
| Accepted sources without valid employment |            98 |    95 |     -3 |
| Valid project rows                        |           378 |   378 |      0 |
| Source extraction failures                |             0 |     0 |      0 |
| Automatically complete for validation     |             2 |     2 |      0 |
| Existing employment tuples removed        |             — |     0 |      0 |

All ten added tuples are confined to three sources (two DOC and one DOCX). Source-level comparison found no prior employment tuple removed. The new employment gap queues are: 40 near-heading/date boundary, 39 project/client-heavy without employer proof, eight explicit-employer labels needing field review, seven headed tables needing layout review and one other narrative/layout. The three recovered sources came from the near-heading/date group. These are heuristic review queues, not claims that every source has a parser defect. Employer/client/project ownership and exact dates remain review-critical.

## Release decision

This subset does not prove correctness across all originals. The broader available corpus has 892 unique sources, at least 78 short of the 970 minimum, with PDF/OCR layout review unresolved. The private PDF transfer still returned HTTP 502 during this run. Live production-provider OCR, isolated restore, private Storage/RLS/Auth cutover, authenticated readback and reviewed backfill have not been established by this batch. Production and bulk upload remain **NO_GO**; no production write or runtime configuration change occurred.

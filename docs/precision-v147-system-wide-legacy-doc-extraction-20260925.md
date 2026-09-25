# System-wide legacy DOC extraction — 2026-09-25

## Scope and shared rule

Admin bulk upload, candidate-owned upload and the private offline audit now use
the same fail-closed extractor for legacy binary Word `.doc` files. The shared
source layer verifies the OLE compound-file signature before parsing, never
decodes binary Word bytes as plain text and retains unreadable originals for
private review. `.rtf` remains unsupported because the measured collection has
only one unique RTF source and no evidence yet justifies a separate parser.

The original-CV archive key, collection manifest, upload planners, signing
routes and both upload interfaces accept `.doc`; maximum size, SHA-256,
ownership and private-Storage checks remain unchanged. Synthetic positive,
invalid-signature and empty-extraction cases cover the shared boundary. No
candidate-specific rule or identifier was added.

## Same-population private comparison

The comparison used the same aggregate collection fingerprint before and after
the change. The private Word collection has 363 files, 357 unique byte
sequences and six duplicates:

| Unique format | Sources |
| ------------- | ------: |
| DOCX          |     189 |
| DOC           |     167 |
| RTF           |       1 |

| Aggregate result            | Before | After | Delta |
| --------------------------- | -----: | ----: | ----: |
| Source failures             |    168 |     3 |  -165 |
| Valid employment rows       |    484 |   798 |  +314 |
| Valid project rows          |    196 |   332 |  +136 |
| Complete for validation     |      0 |     1 |    +1 |
| Sources routed to review    |    182 |   342 |  +160 |
| Accepted employment-gap set |     50 |   103 |   +53 |

The increase in review and employment-gap counts is expected: those sources
were previously opaque source failures and are now readable, structured and
routed through the same quality gates. It is not a regression or an assertion
that missing employer evidence can be inferred.

The remaining accepted sources without valid employment are grouped as:

| Employment gap queue     | Sources |
| ------------------------ | ------: |
| Near career heading/date |      43 |
| Project/client-heavy     |      39 |
| Explicit employer label  |      12 |
| Headed table             |       8 |
| Other narrative/layout   |       1 |
| Short or missing source  |       0 |

Two unique DOC sources could not be read safely and remain source failures; the
single RTF source remains explicitly unsupported. No filename, candidate
identifier, contact field, source excerpt or per-file digest is stored in this
checkpoint.

## Chronology and search-lifecycle evidence

The parent batch at `7e2370d446cdeb6ffafba19f33ba792397ceb911` was also
measured across 905 available private CVs. Its shared chronology gate excluded
10 project rows with unreadable or reversed ranges while retaining the valid
employment-row count. The same batch made non-SAP profiles explicitly
ineligible for search. Those results remain code/private-audit evidence, not a
production write or acceptance result.

## Release status

Production remains **NO_GO**. The private PDF archive could not be materialized
in this environment, so the complete 970+ same-population audit and real OCR
run are still missing. Fresh restore evidence, Auth/RLS/Storage cutover and
readback, reviewed backfill and exact-artifact runtime acceptance also remain
mandatory. No production database, Storage object or runtime configuration was
changed in this batch.

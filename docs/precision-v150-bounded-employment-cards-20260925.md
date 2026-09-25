# Bounded employment field-card batch (25 September 2026)

This batch changes the shared employment parser only. Admin and candidate
uploads still enter the same `prepareCandidateCv` pipeline, and neither path
receives a profile-specific override.

Complete employment cards whose employer, role and period are printed as
separate labelled fields or adjacent lines inside an employment section can
now be recovered. A card must contain an explicit employer, role and parseable
ordered date range. Project/client boundaries terminate the reader; plain
standalone `Company` cards without an employment heading remain unresolved.
Missing or reversed dates remain missing for review, and a client or project
name is never promoted to employer.

## Same-population private result

The read-only comparison used the same 363 Word files (357 unique byte
contents and six duplicates) before and after the change. The aggregate
collection fingerprint and unique-source count matched. The before side is
commit `78b56e1958c16335ad8b6fdbf0db844d1beaadcd`, which already includes the
v149 project-assertion union.

| Measure | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Source extraction failures | 0 | 0 | 0 |
| Valid employment rows | 808 | 816 | +8 |
| Valid project rows | 347 | 347 | 0 |
| Sources without valid employment | 103 | 100 | -3 |
| Exact employer/client conflict sources | 1 | 1 | 0 |

The remaining 100 employment gaps are grouped as follows: 43 heading/date
boundary layouts, 38 project/client-heavy sources without employer evidence,
11 explicit-employer layouts missing another required field, seven headed
table layouts, and one other narrative/layout case. These are review queues,
not permission to infer an employer or date.

The private audit serialized zero filenames, candidate identifiers, contacts,
source excerpts and per-file hashes, and performed zero database writes.
Deidentified positive and negative regressions cover labelled and adjacent
employment cards, project/client boundaries and reversed dates.

## Release status

This is a Word-subset parser result, not acceptance for the complete collection.
The full 905-file archive still contains only 892 unique sources, 14 PDFs need
live OCR and 61 PDFs need layout fallback. Current restore evidence,
production RLS/Auth/private Storage cutover and readback, authenticated
synthetic upload/OCR, reviewed backfill and the complete 970+ audit remain
required. `readyForBulkUpload` remains `false`; production remains **NO_GO**.


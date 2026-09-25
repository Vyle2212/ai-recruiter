# OCR outcome accounting for the shared CV parser

Admin and candidate uploads continue to use the same `prepareCandidateCv`
pipeline. The private aggregate audit now records native versus OCR extraction
and separates OCR outcomes into accepted, complete, needs-review,
classification-review and quality-rejected counts. An OCR invocation can no
longer be presented as a successful parse without its downstream outcome.

The audit remains fail-closed, contains no filenames, identifiers, source
excerpts, contact fields or file digests, and performs no database or Storage
writes. Tests inject a synthetic OCR adapter through the same PDF ingestion
boundary; the default audit still cannot call an external OCR service unless an
operator explicitly enables it.

## Read-only local canary

A local OCR canary ran on private copies of the same byte-unique source set.
This verifies parser behavior after OCR, not the production OCR provider.

| Source group                        |  Files |   Pages | Parser-readable after OCR | Files with recovered employment | Recovered employment rows | Accepted into review | OCR pipeline rejection |
| ----------------------------------- | -----: | ------: | ------------------------: | ------------------------------: | ------------------------: | -------------------: | ---------------------: |
| Empty or page-incomplete PDF text   |     14 |      72 |                        13 |                               6 |                        14 |                    9 |                      1 |
| Native employment layout unresolved |     60 |     249 |                        18 |                              11 |                        22 |                   11 |                     49 |
| **Combined**                        | **74** | **321** |                    **31** |                          **17** |                    **36** |               **20** |                 **50** |

All 20 accepted files still require review; none became complete for release.
Four additional files in the first group remained classification or quality
review rather than accepted. OCR therefore recovers useful evidence, but it is
not a safe substitute for completeness and accuracy validation.

No production database, Storage object or candidate record changed. Bulk
upload and replacing existing profiles remain blocked until a current isolated
restore, private Storage/RLS, authenticated production-provider OCR canaries
and transactional readback have all passed. The archive also remains at least
78 distinct originals short of a 970-unique-file release audit.

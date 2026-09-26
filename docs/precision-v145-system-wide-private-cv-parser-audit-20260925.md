# System-wide private CV parser audit — 2026-09-25

## One shared path, one population-level measurement

Admin and candidate uploads already use `prepareCandidateCv`. The offline audit
now runs that exact parser over every unique PDF, DOCX and TXT in a private
directory outside the repository. It refuses fewer than 970 unique CV byte
sequences, binds the aggregate to the parser commit and one collection
fingerprint, and supports an exact same-population before/after comparison. No
per-profile repair or hardcoded candidate rule was added.

The report contains only totals for parser outcomes, native/OCR handling,
missing required fields, missed source sections, valid employment/project rows
and the six existing employment-gap layout queues. Filenames, per-file hashes,
source text, candidate identifiers and contact fields are never serialized.
Unknown field keys are collapsed to `other`.

## Existing private-source baseline

The latest complete stored-source comparison remains **737/970 sources with
employment and 2,160 rows**, leaving **233** sources grouped as follows:

| Unresolved group         | Sources | Current barrier                                     |
| ------------------------ | ------: | --------------------------------------------------- |
| Project/client-heavy     |     174 | Assignment evidence does not prove payroll employer |
| Near career heading/date |      39 | Company, role or date lacks an owned boundary       |
| Other narrative/layout   |      14 | No repeatable employer-role field boundary          |
| Short or missing source  |       4 | Available source text is insufficient               |
| Explicit employer label  |       1 | Ownership/source version needs adjudication         |
| Headed table             |       1 | Column ownership remains ambiguous                  |

These are review queues, not 233 proven parser defects. A parser batch may be
promoted only when de-identified positive and negative fixtures cover the
target layouts and the full same-population comparison reduces gaps without
losing previous tuples, merging employer with client/project, or inventing
dates.

## Verification and blocker

Synthetic regressions cover all six group classifiers, duplicate bytes,
missing fields, OCR-required sources, parser/source failures, privacy, the
970-unique minimum and before/after comparison. Shared ingestion parity,
TypeScript and the production build are also required.

The complete original CV directory is not available in this workspace, so no
new original-file before/after counts are claimed. Real OCR, restore evidence,
Auth/RLS/Storage cutover, reviewed backfill/readback and the complete 970-source
runtime audit remain blockers. The audit always returns
`readyForBulkUpload: false`; production remains **NO_GO**.

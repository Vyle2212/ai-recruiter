# Full-collection CV parser audit

Both admin and candidate CV uploads call `prepareCandidateCv`. The offline audit
calls the same parser on every PDF, DOCX and TXT in a directory **outside this
repository**, including nested folders. Run from the repository root:

```sh
node --import tsx scripts/auditOfflineCvParser.ts --directory /private/path/to/original-cvs --minimum-unique 970
```

The command reads files and reports aggregate counts only. It does not upload
the collection, write candidate records, log filenames, include extracted text
in the report, or invoke external OCR by default. `ocrRequired` counts PDFs
whose text, encoding or page extraction needs OCR. `employmentLayoutUnresolved`
counts readable PDFs where the employment structure was not recovered; those
need parser investigation and may invoke OCR in the live upload pipeline.
`--allow-ocr` explicitly enables the
same Google Vision fallback used by uploads; use only in an approved private
environment with configured credentials and expected processing costs.

The command refuses to emit a report unless it sees at least 970 unique file
byte sequences by default. `--minimum-unique` may only be lowered for isolated
synthetic tests; a release audit must keep the 970 minimum or raise it to the
measured collection size.

The JSON is bound to the exact parser commit and a single aggregate collection
fingerprint, and counts unique file bytes separately from duplicate copies.
Per-file hashes are never emitted. Each
unique file has exactly one outcome: `completeForValidation`, `needsReview`,
`classificationReview`, `qualityRejected`, `ocrRequired`,
`employmentLayoutUnresolved` or `sourceFailures`.
`classificationByType` distinguishes uncertain SAP evidence from confidently
non-SAP documents and job descriptions; no file is deleted by this audit.
Missing required fields and source sections are aggregated across files.
Employment gaps are grouped into the same six layout/cause queues used by the
970-source stored-text audit, and valid employment/project row totals are
included. Untrusted field names are collapsed to `other`; filenames, hashes,
source text, candidate identifiers and contact fields remain absent.
`completeForValidation` means the automated checks found no missing mandatory
field or observed section; it is **not** proof that every field matches the
original. Classification remains reviewable. The report always sets
`readyForBulkUpload: false` because this diagnostic is separate from restore,
access-control, live OCR and release checks.

To evaluate precision, check the complete collection and compare a reviewed
sample against the originals, including every reported parser pattern and
OCR-required class. Correct a shared extraction rule, rerun the whole audit,
and keep unresolved originals private for review. Do not report 100% accuracy
from synthetic tests or three sample files. The full collection is not present
in CI; CI runs synthetic parity and aggregate/privacy checks only.

To compare a parser batch against an earlier aggregate report, keep that report
outside the repository and pass it as `--baseline /private/path/baseline.json`.
The comparison requires the exact aggregate collection fingerprint and reports
only same-population status and count deltas. A population mismatch invalidates
the comparison and cannot be used as evidence of improvement.

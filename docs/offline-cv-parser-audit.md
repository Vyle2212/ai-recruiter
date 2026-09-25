# Full-collection CV parser audit

Both admin and candidate CV uploads call `prepareCandidateCv`. The offline audit
calls the same parser on every PDF, DOCX and TXT in a directory **outside this
repository**, including nested folders. Run from the repository root:

```sh
node --import tsx scripts/auditOfflineCvParser.ts --directory /private/path/to/original-cvs
```

The command reads files and reports aggregate counts only. It does not upload
the collection, write candidate records, log filenames, include extracted text
in the report, or invoke external OCR by default. `ocrRequired` counts PDFs
whose native text could not be trusted. `--allow-ocr` explicitly enables the
same Google Vision fallback used by uploads; use only in an approved private
environment with configured credentials and expected processing costs.

The JSON counts unique file bytes separately from duplicate copies. Each
unique file has exactly one outcome: `completeForValidation`, `needsReview`,
`classificationReview`, `qualityRejected`, `ocrRequired` or `sourceFailures`.
Missing required fields and source sections are aggregated across files.
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

# Shared CV parser: RTF source batch (25 September 2026)

Admin and candidate uploads now accept RTF and Word files containing RTF
bytes through the same `prepareCandidateCv` pipeline. The parser validates the
RTF header, removes long hexadecimal image payloads from extracted text,
rejects unreadable or excessively large text, and keeps the original file in
private review storage when parsing fails. Both upload entry points and the
original-file manifest recognize RTF; search and profile completeness gates
remain in force.

The private, read-only audit used the same 905 originals before and after the
change (892 different byte contents, 13 duplicate files). Source extraction
failures fell from 3 to 0; 3 additional files reached review, while the count
complete for validation remained 2. Valid employment rows rose from 1,771 to
1,781. No candidate identifiers, filenames, file hashes or source excerpts
are contained here.

This result measures source readability, **not** field-level accuracy for all
profiles. Fourteen PDFs still require OCR, 61 PDFs need an employment layout
fallback, and 760 accepted files still require profile review. At least 78
additional different originals are needed to reach a 970-file unique-source
target. The audit reports `readyForBulkUpload: false`.

Verified locally: parser parity and invalid-source tests, original archive and
manifest tests, admin bulk upload test, TypeScript typecheck, Webpack production
build, and deployment traces containing the RTF runtime for both CV upload
APIs. No production data or configuration was changed.

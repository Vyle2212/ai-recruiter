# Precision v143 — shared TXT/DOCX extraction gate (2026-09-25)

## Outcome

Admin bulk upload and candidate-owned upload now send non-PDF sources through the same fail-closed document extraction gate before the SAP parser runs.

- TXT decoding supports UTF-8 (with or without BOM), UTF-16LE, and UTF-16BE, including conservative BOM-less UTF-16 detection.
- Invalid encodings, embedded NUL/control data, empty text, corrupt DOCX containers, and unsupported types cannot become partial candidate profiles.
- Source failures remain in private storage and are routed to source review by both upload paths.
- PDF, DOCX, and TXT still converge on the same parser, SAP classification, completeness checks, candidate lifecycle, and search eligibility rules.

The regression fixtures are synthetic and contain no candidate identifiers or contact data.

## Verification

- TXT compatibility regression covers UTF-8 BOM, UTF-16LE/BE, BOM-less UTF-16LE, corrupt binary text, corrupt DOCX, and unsupported extensions.
- The parser-level regression verifies that a UTF-16 SAP CV reaches the shared parser without NUL corruption.
- Typecheck, production trust CI, immutable CI, build, and preview results must bind to the exact commit before promotion.

## Release state

No production database, Auth, Storage, CV, search index, or deployment was changed. Production remains `NO_GO` until restore evidence, the reviewed RLS/foundation cutover and readback, and authenticated live upload/OCR acceptance are complete. The original 970+ CV set is still required for measured full-corpus extraction; this code change is not evidence that all profiles parse correctly.

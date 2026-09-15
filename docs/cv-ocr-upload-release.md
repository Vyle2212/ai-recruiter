# CV upload OCR integration

## Behavior

PDF CV uploads use positioned native extraction first. OCR is requested for very short/empty text, repeated replacement characters, or an explicitly labelled employment section for which the canonical parser finds no employment. The last condition is a review signal, not proof that a PDF is corrupted; unsupported layouts can trigger it too.

The fallback uses the installed Google Cloud Vision client and `batchAnnotateFiles` with `application/pdf` and `DOCUMENT_TEXT_DETECTION`. It sends at most five explicitly numbered pages per request and validates every expected page, including blank pages. Missing, duplicate, unexpected, or errored pages reject the entire file. The original page count must agree with the response when supplied. No first-five-pages-only result is accepted as a complete CV.

The application limit is 50 pages and 20 MiB per OCR document, with a 45-second total deadline and SDK retries disabled. OCR runs only after native extraction needs recovery. Credentials are initialized lazily, so a missing OCR configuration does not prevent readable native CVs from being parsed.

OCR output passes source checks again. If native employment was unresolved, OCR must actually recover employment; dropping the section header does not make the result acceptable. The existing classification and resume-quality gates still apply before saving.

The upload route returns `SOURCE_REVIEW_REQUIRED` plus a typed `OCR_*` error for incomplete, unavailable, or unsuccessful OCR. Failed files do not reach `saveCandidate`; later valid files in the same batch can still succeed. Successful results expose the extraction method and page count, and persisted extraction notes identify OCR-derived source text. Raw OCR text retains line breaks through the existing source-preservation path.

The legacy PDF OCR helper now uses the document API as well. The image helper routes PDF bytes to that helper instead of sending a PDF as an image.

## Verification performed

- Synthetic client tests cover multi-batch seven-page extraction, reversed page responses, blank pages, absent/duplicate/unexpected pages, file/page errors, page/size limits, deadline expiry, and absent/invalid configuration.
- An upload-route test confirms an OCR failure does not invoke `saveCandidate`, while a later valid file succeeds and reports its method.
- The original corrupted-font PDF was processed through `parseCv` with injected, previously reviewed OCR text. It invoked the fallback and produced five employment rows. Unreadable replacement output was rejected.
- A readable original PDF produced three employment rows without invoking OCR.
- Source-preservation and canonical employment regressions pass. Typecheck and webpack build pass.

These tests do not prove that Google OCR returns identical text to the local OCR engine, or establish live database persistence and production acceptance.

## Outstanding release gates

1. Configure the existing server-only `GOOGLE_CREDENTIALS` service-account setting in the target environment with access to document OCR. Do not put credential contents in source code, chat, or client-exposed variables.
2. Run a real authenticated upload using the corrupted-font CV and compare the Google OCR result against the original employment section. Verify extraction provenance in the saved row.
3. Backfill only reviewed originals, respecting changed CV versions; audit the complete 970-profile population.
4. Complete authenticated acceptance against the exact deployed commit before production promotion.

No live Google OCR call, database mutation, or production promotion was performed in this session. OCR credentials were absent locally; connected Supabase/Vercel plugins still exposed no callable runtime operations. Release remains NO_GO until the outstanding gates are satisfied.

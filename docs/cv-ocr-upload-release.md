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

## Continuation checkpoint: CI coverage

The precision feature branch previously triggered only the immutable-action-reference workflow. Production Trust CI now includes `codex/precision-*` pushes and pull requests targeting `codex/profile-source-recovery`, retaining all existing security, dependency, secret-history, formatting, build and regression gates. Six source-layout/OCR tests are included in its security-and-regression job.

Local route-policy coverage found no missing policies across 78 route files and 95 exported methods. The authorization matrix passed, and the client-bundle scan inspected 297 files with zero forbidden-pattern hits. These local checks are not authenticated production acceptance.

Next continuation: inspect the full Production Trust CI run on the latest PR head and fix any failed gates without weakening them. Keep the draft release status until complete data audit and exact-deployment acceptance evidence exist. Continue repository and CI work through the connected GitHub app; runtime configuration and data writes remain blocked by the unavailable runtime operations described above.

## Continuation checkpoint: flattened structured employment forms

The private 277-source review subset exposed three additional employment layouts with explicit field boundaries: repeated `Date -> Company -> Role` rows, numbered `Position Title -> Working Period` rows, and parenthesized employer headings whose month and year are joined (for example, `Feb2019`). The parser now handles those forms only inside a bounded employment section, stops before project/client sections, validates chronological ranges, and requires a role-like title where the source supplies one. It does not infer missing dates or promote project clients to employers.

On the unchanged private subset, current extraction increased from 70 profiles / 277 employment rows to 73 profiles / 285 rows. Profiles without employment decreased from 207 to 204. Malformed, duplicate and invalid-range diagnostics remain zero; overlap review remains seven profiles and the possible client/employer equality flag remains one. This is a subset-only parser regression result: 693 of the declared 970 sources remain unaudited, and no source record or database row was changed.

Synthetic regressions cover repeated rows, project-section isolation, client-labelled rejection, invalid ranges, role validation, compact dates and numbered working-period forms. Existing employment, canonical, source-preservation and OCR regressions plus typecheck pass locally. Exact-head GitHub CI must pass again before this checkpoint is considered code-complete; live OCR, reviewed backfill, full-population audit and authenticated exact-deployment acceptance remain release blockers.

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

No live Google OCR call, database mutation, or production promotion was performed in this session. Runtime Supabase/Vercel changes are outside this automated GitHub-only scope. Release remains NO_GO until the outstanding gates are satisfied.

## Continuation checkpoint: CI coverage

The precision feature branch previously triggered only the immutable-action-reference workflow. Production Trust CI now includes `codex/precision-*` pushes and pull requests targeting `codex/profile-source-recovery`, retaining all existing security, dependency, secret-history, formatting, build and regression gates. Seven source-layout/OCR tests are included in its security-and-regression job.

Local route-policy coverage found no missing policies across 78 route files and 95 exported methods. The authorization matrix passed, and the client-bundle scan inspected 297 files with zero forbidden-pattern hits. These local checks are not authenticated production acceptance.

Exact-head commit `d91380801c128d4f9a700131aeab4a87de94ca07` passed the full Production Trust push and pull-request runs, including dependency, secret-history, regression, typecheck, build and client-bundle gates. Continue evidence-bounded parser coverage through GitHub without weakening those gates. Keep the draft release status until live OCR, reviewed backfill, complete data audit and exact-deployment acceptance evidence exist; runtime configuration and data writes remain outside this automated scope.

## Continuation checkpoint: flattened structured employment forms

The private 277-source review subset exposed three additional employment layouts with explicit field boundaries: repeated `Date -> Company -> Role` rows, numbered `Position Title -> Working Period` rows, and parenthesized employer headings whose month and year are joined (for example, `Feb2019`). The parser now handles those forms only inside a bounded employment section, stops before project/client sections, validates chronological ranges, and requires a role-like title where the source supplies one. It does not infer missing dates or promote project clients to employers.

On the unchanged private subset, current extraction increased from 70 profiles / 277 employment rows to 73 profiles / 285 rows. Profiles without employment decreased from 207 to 204. Malformed, duplicate and invalid-range diagnostics remain zero; overlap review remains seven profiles and the possible client/employer equality flag remains one. This is a subset-only parser regression result: 693 of the declared 970 sources remain unaudited, and no source record or database row was changed.

Synthetic regressions cover repeated rows, project-section isolation, client-labelled rejection, invalid ranges, role validation, compact dates and numbered working-period forms. Existing employment, canonical, source-preservation and OCR regressions plus typecheck pass locally. Exact-head GitHub CI passed for parser commit `d91380801c128d4f9a700131aeab4a87de94ca07`; live OCR, reviewed backfill, full-population audit and authenticated exact-deployment acceptance remain release blockers.

## Continuation checkpoint: labelled join/left employment records

Numbered employment records using `Company Name`, `Position Title`, `Date Join` and `Date Left` now remain bounded to employment history even when a nested project/assignment block appears between records. `Date Join` and `Date Joined` are accepted as equivalent explicit labels. A blank or dash-only `Date Left` is preserved as an unknown end rather than being converted to `Present` or filled from a project duration. Project-only copies of the same labels remain excluded.

On the same private 277-source review subset, current extraction increased from 73 profiles / 285 employment rows to 74 profiles / 293 rows. Profiles without employment decreased from 204 to 203. Malformed, duplicate and invalid-range diagnostics remain zero; overlap review remains seven profiles and the possible client/employer equality flag remains one. Two of the recovered rows have an explicitly missing date endpoint; diagnostics treat those as incomplete evidence rather than invalid chronology. No source record or database row was changed, and 693 of the declared 970 sources remain unaudited.

The labelled partial-date regression is now part of the mandatory Production Trust source-layout test group. Local tests, private-subset audit and exact-head GitHub CI passed for parser commit `d91380801c128d4f9a700131aeab4a87de94ca07`. The release remains NO_GO pending live OCR, reviewed backfill, full-population audit, and authenticated acceptance of the exact deployable artifact.

## Continuation checkpoint: employer/client/title separation

Some employment histories place a parenthesized tenure before the employer, then identify the assignment organization with a separate `Client` label and the employment role with `Current Position Title`. The parser now accepts this layout only after an employment-history heading, before any project-history section, and with a valid explicit date range. The employer is read only from the text before `Client`; the client is retained as a boundary and is never promoted to employer or used for tenure.

On the same private 277-source review subset, current extraction increased from 74 profiles / 293 employment rows to 75 profiles / 296 rows. Profiles without employment decreased from 203 to 202. Malformed, duplicate and invalid-range diagnostics remain zero; overlap review remains seven profiles and the possible client/employer equality flag remains one. All three recovered rows have explicit company, title and date ranges. No source record or database row was changed, and 693 of the declared 970 sources remain unaudited.

Synthetic regressions cover multiple employer/client/title rows, dotted legal company suffixes, project-section rejection and reversed-date rejection. Existing employment, canonical, source-preservation and OCR regressions plus typecheck must pass before promotion, followed by exact-head GitHub CI. Live OCR, reviewed backfill, full-population audit and authenticated exact-deployment acceptance remain release blockers.

## Continuation checkpoint: organization/duration/designation rows

An additional professional-experience layout repeats explicitly labelled `Organization`, `Duration` and `Designation` fields. The parser now accepts complete rows only inside a bounded employment section, requires an explicit valid month/year range, and stops before project history. It does not promote project organizations to employers or synthesize missing endpoints.

On the unchanged private 277-source review subset, current extraction increased from 75 profiles / 296 employment rows to 76 profiles / 301 rows. Profiles without employment decreased from 202 to 201. Malformed, duplicate and invalid-range diagnostics remain zero; overlap review remains seven profiles and the possible client/employer equality flag remains one. The five recovered rows have explicit company, title and date ranges. No source record or database row was changed, and 693 of the declared 970 sources remain unaudited.

Synthetic regressions cover multiple labelled rows, project-section isolation and reversed-date rejection. This remains a code-only checkpoint: exact-head CI is required before merge, and live OCR, reviewed backfill, full-population audit and authenticated exact-deployment acceptance remain release blockers.

## Continuation checkpoint: role/company/period rows

One employment-history layout repeats a role, an employer ending in an explicit legal suffix, and a labelled `Period`. The parser now accepts those rows only inside a bounded employment-history section. It requires a short role-shaped title, a legal employer suffix, and a chronologically valid explicit date range. Ordinal day prefixes are retained as source evidence but evaluated at month precision. Project sections and reversed ranges remain excluded.

On the unchanged private 277-source review subset, current extraction increased from 76 profiles / 301 employment rows to 77 profiles / 306 rows. Profiles without employment decreased from 201 to 200. Malformed, duplicate and invalid-range diagnostics remain zero; overlap review remains seven profiles and the possible client/employer equality flag remains one. The five recovered rows have explicit company, title and date ranges. No source record or database row was changed, and 693 of the declared 970 sources remain unaudited.

Synthetic regressions cover multiple legal-employer rows, ordinal dates, project-section isolation and reversed-date rejection. Exact-head CI remains required before merge. Live OCR, reviewed backfill, full-population audit and authenticated exact-deployment acceptance remain release blockers.

## Continuation checkpoint: located employer history

One employment history lists repeated `Employer (city), country from date to date` rows before a separate project section. The parser now retains those explicit employer tenures, stores the location separately, accepts an explicitly written `till date` as current, and stops before projects. Because the employment rows do not state a role, their titles remain empty; project roles are not borrowed to fill them.

On the unchanged private 277-source review subset, current extraction increased from 77 profiles / 306 employment rows to 78 profiles / 311 rows. Profiles without employment decreased from 200 to 199. Malformed, duplicate and invalid-range diagnostics remain zero; overlap review remains seven profiles and the possible client/employer equality flag remains one. All five recovered rows have explicit employers and date ranges, while all five intentionally retain a missing employment title. No source record or database row was changed, and 693 of the declared 970 sources remain unaudited.

Synthetic regressions cover repeated employer/location rows, an employer suffix after the parenthesized city, project-section isolation, current-status normalization and reversed-date rejection. Exact-head CI remains required before merge. Live OCR, reviewed backfill, full-population audit and authenticated exact-deployment acceptance remain release blockers.

## Continuation checkpoint: complete endpoint tokens

The role/company/period and located-employer readers previously accepted prefixes of malformed endpoints: `Jan 20200` became `Jan 2020`, while `Nowhere` and `Currently unavailable` became current employment. Both readers now require the endpoint token to end before another letter, digit or underscore. Synthetic negative regressions reproduce these failures and cover both layouts; existing valid current and dated rows remain covered.

The unchanged private 277-source subset still yields 78 profiles / 311 employment rows, with 199 unresolved profiles. Comparing complete employment timelines against the preceding parser produced zero changed profiles. Malformed, duplicate and invalid-range diagnostics remain zero. This is a precision repair, not additional source recovery or backfill. The other 693 sources remain unaudited.

Local employment/canonical regressions and typecheck must pass, followed by exact-head GitHub CI. Live OCR, reviewed backfill, full-population audit and authenticated acceptance of the exact deployable artifact remain required; production remains NO_GO.

## Continuation checkpoint: duration/employer descriptions

A bounded employment-history layout places explicit `Duration` and `Employer` labels before a legal employer name and a dash-separated company description. The parser now retains the employer and valid month/year tenure while leaving the title empty: the later unlabelled role cannot be safely separated from the company description. It rejects project sections, client-labelled substitutes, reversed dates and malformed endpoint prefixes.

On the unchanged private 277-source subset, extraction increased from 78 profiles / 311 rows to 79 profiles / 313 rows, leaving 198 profiles without employment. Only one profile's employment timeline changed; its two recovered rows have explicit employers and complete historical ranges, and both retain blank titles. All other employment timelines are identical to the preceding checkpoint. Malformed, duplicate and invalid-range counts remain zero. No source or database records were changed; the other 693 sources remain unaudited.

The 15 local employment/canonical regression files and TypeScript typecheck passed. The new negative and positive cases are part of the mandatory source-layout CI group. Exact-head GitHub CI is required before merge. Live OCR, reviewed backfill, full-population audit and authenticated exact-artifact acceptance remain blockers; production remains NO_GO.

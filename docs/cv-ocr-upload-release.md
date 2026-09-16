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

The precision feature branch previously triggered only the immutable-action-reference workflow. Production Trust CI now includes `codex/precision-*` pushes and pull requests targeting `codex/profile-source-recovery`, retaining all existing security, dependency, secret-history, formatting, build and regression gates. Nine source-layout/OCR and career-date tests are included in its security-and-regression job.

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

## Continuation checkpoint: calendar-day validation

Named dates previously discarded the explicit day before validating month precision, accepting impossible inputs such as `31st April 2024`, `29th February 2023`, and day zero or 99. The shared career-date reader now validates the complete named calendar date with UTC round-tripping before reducing it to month precision. Valid leap days, abbreviated months and two-digit year rules remain supported. Invalid dates cannot contribute to total career duration or a parsed role/company/period range.

The career-date consistency regression is now mandatory in Production Trust CI. Synthetic tests cover invalid month lengths, leap-year century rules, zero/overflow days, equivalence with valid ISO dates and exclusion from canonical career calculations. Local career-date tests, all 15 employment/canonical regression files, typecheck and required formatting checks passed.

Against commit `c12023226c16ebb17c5b4ae5481feceef1d154de`, the private 277-source comparison found zero changed employment timelines and zero changed experience summaries: 79 profiles / 313 rows, 198 unresolved, and zero malformed, duplicate or invalid-range diagnostics. The other 693 sources remain unaudited. This precision fix does not establish live OCR, reviewed backfill or authenticated exact-artifact acceptance. Production remains NO_GO.

## Continuation checkpoint: terminal organization rows

The `Organization -> Duration -> Designation` reader required whitespace before its end-of-section alternative. As a result, a complete employment record ending exactly at the final title was lost after source trimming. The boundary now accepts the actual end of the bounded employment section, with or without trailing whitespace. Education and project sections remain excluded, and reversed dates remain rejected.

Synthetic regressions reproduce the previous omission and cover end-of-document, trailing whitespace, education/project transitions and project-only rejection. All 16 local employment, calendar-date and canonical regression files plus typecheck passed. The unchanged private 277-source subset still yields 79 profiles / 313 rows, with 198 unresolved and zero changed employment timelines. Malformed, duplicate and invalid-range diagnostics remain zero. This is a coverage regression repair, not additional recovery measured on that subset.

Exact-head CI remains required. Live OCR, reviewed backfill, the remaining 693 sources and authenticated exact-artifact acceptance remain outstanding; production remains NO_GO.

## Continuation checkpoint: heading/duration/position forms

A flattened employment form places the employer immediately after `Working Experience` or `Employment History`, followed by explicit `Duration`, `Position` and `Salary` labels. The parser now uses the heading as the employer's left boundary and those labels as field boundaries. Salary is used only as a delimiter and excluded from employment evidence. Later unlabelled employer names embedded in responsibility prose are not guessed. Education before employment is supported; project sections, client-labelled employers and reversed or malformed date ranges remain excluded.

The private 277-source subset increased from 79 profiles / 313 rows to 80 profiles / 315 rows, leaving 197 profiles without employment. One previously unresolved profile gained two complete employer/title/date records; all other employment timelines are unchanged. Malformed, duplicate and invalid-range diagnostics remain zero. This does not recover every job in that profile: unbounded rows still require source-layout review. No backfill or source mutation was performed, and 693 sources remain unaudited.

All 16 local employment/calendar/canonical regression files and typecheck passed. Synthetic cases cover repeated headings, education-first ordering, ambiguous unbounded rows, salary evidence exclusion, project/client isolation and invalid ranges. Exact-head CI remains required; live OCR, reviewed backfill, full-population audit and authenticated exact-artifact acceptance still block production (NO_GO).

## Continuation checkpoint: explicit project employer linking

The project-to-employment linker ignored a project's explicit employer and could attach it to another company with overlapping dates and the same role. Explicit project employers now require equality with the employment company under the existing company-name normalization; role similarity, client names, narrative mentions and nested-source provenance cannot override that boundary. Matching employers still require project dates inside the employment tenure. A matching employer can link a project whose role differs from the employment title. Projects without explicit employers retain the existing fallback rules.

Synthetic canonical regressions cover cross-company rejection, client isolation, conflicting narrative/provenance, normalized legal suffixes, different roles, partial-name rejection and temporal containment. The canonical employment version is incremented so cached profiles are rebuilt. All 16 local employment/calendar/canonical regression files and typecheck passed.

Comparing the unchanged private 277-source subset with commit `1585aa0bde41f98c501e48665c2ec223ea8ccb18` produced zero changed employment timelines or project links: 80 profiles / 315 rows, 197 unresolved profiles and eight existing links. Malformed, duplicate and invalid-range diagnostics remain zero. This is a reproduced precision repair, not additional measured source recovery or backfill. The other 693 sources remain unaudited. Exact-head CI is still required; live OCR, reviewed backfill, full-population audit and authenticated exact-artifact acceptance remain release blockers (NO_GO).

## Continuation checkpoint: project range validation

The containment check previously compared only the project start against the employment start and the project end against the employment end. A reversed project range could satisfy both comparisons, even with both endpoints outside the employer tenure. The linker now requires chronological ordering in both ranges before accepting containment. Missing or invalid dates remain ineligible for linking; dates are not rewritten or inferred. Valid same-month projects still link. The employment cache version is incremented again.

Canonical normalization regressions reproduce reversed project ranges inside and outside the employment interval, and cover missing starts/ends, impossible calendar dates and valid same-month ranges. All 16 local employment/calendar/canonical regression files and typecheck passed. Against commit `460d8381c1969124d67337b57af1be761fee632c`, the unchanged 277-source comparison found zero changed employment timelines or links: 80 profiles / 315 rows, 197 unresolved, eight links, and zero malformed, duplicate or invalid-range employment diagnostics. This does not establish valid dates for all project records; it prevents invalid ranges from supporting employment links.

The preceding explicit-employer fix passed Production Trust CI run `35039345707`, immutable-action CI run `35039345752` and both preview statuses. This new range-validation revision still requires its own exact-head CI. No database or source changes were made. The remaining 693 sources, live OCR, reviewed backfill and authenticated exact-artifact acceptance continue to block production (NO_GO).

## Continuation checkpoint: link phrase boundaries

The fallback project linker accepted substrings inside unrelated words: an employer ending in `Alpha` matched `Alphabet`, and `Architect` matched `Architecture`. A company consisting only of a stripped legal suffix also produced an empty key that matched every narrative. Employer mentions and role compatibility now require nonempty normalized phrases with word boundaries. Complete phrases, punctuation-separated employer mentions and longer role phrases remain supported. Explicit-employer precedence and chronological containment remain enforced. The canonical employment version is incremented.

The new synthetic regression failed on the preceding revision and passes after this change. All 16 local employment/calendar/canonical regression files and typecheck passed. Against commit `2b7f33a111f538442812e7f77c5e15a3231e0894`, the unchanged 277-source comparison found zero changed employment timelines or project links: 80 profiles / 315 rows, 197 unresolved and eight links. Malformed, duplicate and invalid-range employment diagnostics remain zero. No source or database records were changed.

The preceding revision passed Production Trust run `35039849180`, immutable-action run `35039849200` and both previews. This revision requires its own exact-head CI. Live OCR, reviewed backfill, the remaining 693 sources and authenticated exact-artifact acceptance still block production (NO_GO).

## Continuation checkpoint: structured current flags

Structured employment used a string/number field reader for `current`, `is_current` and `isCurrent`, silently discarding boolean `true`. The reader now preserves boolean flags and the first explicitly supplied alias, including `false`. Existing string and numeric representations and explicit current endpoint labels remain supported. A current flag does not invent a missing start or a dated endpoint. The canonical employment cache version is incremented.

Synthetic tests cover all three aliases, boolean/string/numeric values, conflicting aliases and a current job with no start date. All 16 employment/calendar/canonical regression files and typecheck passed. Against commit `498abff4833b8e9d479fb5413a7ff1a35e30aebd`, the private 277-source comparison found no changed employment timelines or experience summaries: 80 profiles / 315 rows, 197 unresolved, and zero malformed, duplicate or invalid-range employment diagnostics. This is a reproduced structured-input repair, not measured additional source recovery.

The preceding revision passed Production Trust run `35040461463`, immutable-action run `35040461591` and both previews. This revision requires its own exact-head CI. No source or database records were changed. Live OCR, reviewed backfill, the remaining 693 sources and authenticated exact-artifact acceptance remain production blockers (NO_GO).

## Continuation checkpoint: complementary partial dates

Employment deduplication merged a start-only row with an end-only row at the same employer and title, creating an unsupported complete tenure. It could even create a reversed date range. Opposite partial endpoints now remain separate when they have no shared temporal anchor. A partial row and complete duplicate with a shared start can still merge. Missing dates remain missing, including current employment with no known start. The canonical employment cache version is incremented.

Synthetic regressions cover chronological and reversed endpoints, current employment, both input orders and a supported shared-start duplicate. All 16 local employment/calendar/canonical regression files and typecheck passed. Against commit `e53a610eca4aab8f98c3561fc9f9fe3e234cf7a3`, the private 277-source comparison found zero changed employment timelines or experience summaries: 80 profiles / 315 rows, 197 unresolved, and zero malformed, duplicate or invalid-range employment diagnostics. No source or database records were changed.

The preceding revision passed Production Trust run `35041621805`, immutable-action run `35041621793` and both previews. This revision requires its own exact-head CI. Live OCR, reviewed backfill, the remaining 693 sources and authenticated exact-artifact acceptance remain release blockers (NO_GO).

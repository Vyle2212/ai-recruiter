# CV upload OCR integration

> Latest database-surface checkpoint: [v110 pre-cutover authorization snapshot](precision-v110-pre-cutover-authorization-snapshot-20260923.md). A read-only, fail-closed SQL artifact now preserves RLS flags, policies, ACLs, view options and RPC security metadata before the destructive authorization cutover. It is not a data backup or automatic rollback and has not run on production; verified backup, authenticated acceptance, controlled cutover/readback and all OCR/backfill gates remain required. Production is NO_GO.

> Latest security checkpoint: [v107 private candidate data RLS cutover](precision-v107-private-data-rls-cutover-20260923.md). A read-only production audit confirmed that `anon` could read and mutate the 970-row candidate table and related public tables. The GitHub batch moves 36 legacy privileged APIs behind recruiter authorization, makes the shared legacy client server-only, and adds a manual deny-by-default RLS cutover artifact. No production database or runtime change occurred. Controlled acceptance, backup, RLS execution/readback and all existing OCR/backfill gates remain required; production is NO_GO.

> Latest read-only source batch: [v106 bounded career field cards](precision-v106-bounded-career-field-cards-20260923.md). The same 970-source snapshot increases from 734 sources / 2,155 employment rows to 737 / 2,160, preserving all earlier tuples and leaving 233 sources in review queues. Historical open dates and competing company cells remain withheld. No reviewed backfill/readback, live OCR or authenticated acceptance on the exact promoted artifact occurred. Production remains NO_GO.

> Latest read-only source batch: [v105 bounded employer headers and separate client/company project ledgers](precision-v105-employer-headers-and-client-ledgers-20260923.md). The same 970-source snapshot increases from 732 sources / 2,148 employment rows to 734 / 2,155, with all earlier tuples retained and 236 sources still routed for review. Three project-backed roles leave original employment dates blank; a historical open project is withheld from present-day tenure. No reviewed backfill/readback, live OCR or authenticated acceptance on the exact promoted artifact occurred. Production remains NO_GO.

> Latest read-only source batch: [v103 bounded repeated career summaries](precision-v103-bounded-career-summaries-20260923.md). On the same 970-source snapshot, four sources gain 24 employment rows: 730 sources / 2,129 rows, with 240 still requiring review. All 2,105 earlier employment tuples are retained. Start-only roles keep a missing end, and SAP core/key/super-user work does not add delivery tenure. No reviewed backfill, live OCR or authenticated acceptance on the promoted artifact occurred; production remains NO_GO.

> Latest read-only career-card batch: [v101 heading-bound career cards](precision-v101-headed-career-cards-20260923.md). Same 970-source snapshot: 723 sources / 2,096 employment rows, 247 still requiring review; nine previously empty sources gain one source-owned row each while all 2,087 earlier rows and all projects are preserved. Non-SAP roles remain general employment and do not add SAP tenure. No reviewed backfill, live OCR, or authenticated exact-artifact acceptance occurred; production remains NO_GO.

> Latest read-only chronology batch: [v100 dated career headings](precision-v100-headed-chronology-20260923.md). Same 970-source snapshot: 714 sources / 2,087 employment rows, 256 still requiring review; five previously empty sources gain 12 source-owned rows. All prior 2,075 rows and 970-source projects are preserved. No reviewed backfill, live OCR or authenticated exact-artifact acceptance occurred; production remains NO_GO.

> Latest read-only owned-project batch: [v99 employer/customer ledgers](precision-v99-owned-project-ledgers-20260923.md). Four employment roles and four linked project periods were recovered from two previously empty sources, with employer distinct from customer and project dates labelled estimated. Same 970-source snapshot: 709 sources / 2,075 rows; 261 sources remain unresolved. All earlier employment tuples and other sources' SAP metrics are unchanged. Production remains NO_GO pending reviewed source adjudication, backfill/readback, live OCR and authenticated exact-artifact acceptance.

> Latest data-integrity correction: [v98 owned label boundaries](precision-v98-owned-label-boundaries-20260923.md). A missing Company in one row can no longer borrow the next row's employer and role. Re-projection of the same 970 sources stays at 707 sources / 2,071 rows, with 263 requiring review; no new source recovery is claimed. Production remains NO_GO pending reviewed backfill/readback, live OCR and authenticated exact-artifact acceptance.

> Latest read-only source batch: [v97 labelled employer/client ledger](precision-v97-labelled-client-employer-20260923.md). The same 970-source snapshot yields 707 sources / 2,071 employment rows, recovering 22 rows from two previously empty sources and preserving all 2,049 earlier rows. 263 sources require review; an explicitly overlapping assignment adds one overlap review flag. Reviewed backfill/readback, live OCR and exact-artifact authenticated acceptance remain blockers (NO_GO).

> Latest source-owned quality checkpoint: [v96 career row ownership](precision-v96-source-ownership-quality-20260923.md). Read-only comparison on the identical 970-source snapshot removes four incorrect/duplicate rows across two sources and trims two non-SAP titles in a third: 705 sources / 2,049 employment rows; 265 still need review. All other source tuples, all SAP experience values and project counts are unchanged. Reviewed backfill/readback, live OCR and exact-artifact authenticated acceptance block production (NO_GO).

> Latest calculation checkpoint: [v95 SAP Sales and Distribution consulting](precision-v95-sap-sd-experience-20260923.md). Same private 970-source read-only comparison changes SAP experience in one source by +1.0 year without changing any employment tuple or project count. The 705 sources / 2,053 rows and 265 unresolved sources remain unchanged. Year-only source dates retain their original precision. Reviewed backfill/readback, live OCR and authenticated exact-artifact acceptance still block production (NO_GO).

> Latest checkpoint: [v94 career field boundaries](precision-v94-career-field-boundaries-20260923.md). Same private 970-source read-only comparison corrects 45 employer/title tuples on 38 sources while keeping every source date, current flag and total row count. Projection remains 705 sources / 2,053 employment rows; 265 sources need review. Malformed, duplicate and invalid-range diagnostics remain zero; overlap and employer/client review flags are unchanged. An earlier over-broad experiment was rejected after it created unreviewed rows. Local mandatory regressions and typecheck pass; exact-head CI, reviewed backfill/readback, live OCR and authenticated acceptance remain required. Production is NO_GO.

> Latest correction: [v93 piped career row ownership](precision-v93-piped-row-ownership-20260923.md). Re-projection of the same private 970-source snapshot preserves all 2,042 v90 employment tuples, adds 11 source-owned rows across three sources, and reaches 705 sources / 2,053 rows. The earlier v91 706/2,065 and repaired-head 706/2,060 projections are superseded because of borrowed titles, reversed columns or location-as-employer rows. The remaining 265 sources are grouped for review; zero malformed/duplicate/invalid-range diagnostics. This is read-only code verification. Reviewed backfill/readback, live OCR and authenticated acceptance on the exact artifact remain required; production is NO_GO.

> Latest checkpoint: [v91 piped employment ownership and candidate API security](precision-v91-piped-employment-security-20260918.md). A bounded `title | employer | period` reader initially projected 706/970 sources and 2,065 rows, but full regression found cross-row date borrowing. The repair preserves explicit date-first overlaps without assigning a following row's period; the projection must be regenerated before use as post-repair evidence. Candidate detail, search, legacy-data and validation endpoints now use recruiter authorization. Local related regressions and typecheck pass; exact-head CI, reviewed backfill/readback, deployed OCR and authenticated acceptance remain required. Production is NO_GO.

> Latest checkpoint: [v88 explicit employer field families](precision-explicit-employer-fields-v88-20260916.md). Full comparison on the reviewed post-backfill 970-source snapshot recovers 12 rows across nine previously empty sources and one populated source, preserves all 2,010 v87 tuples and reaches 700 sources / 2,022 rows. There are 270 sources without extracted employment. Malformed/duplicate/invalid-range counts remain zero; overlap and client/employer flags are unchanged. This is code-only; production remains NO_GO.

> Latest checkpoint: [v87 employer promotion and contract spells](precision-employer-promotion-spells-20260916.md). Full 970-source comparison recovers 13 rows on four previously empty sources, preserves all 1,997 prior tuples and reaches 691 sources / 2,010 employment rows. There are 279 sources without extracted employment. Audit flags are unchanged. This is a code-only batch; the verified seven-original backfill remains the latest database write. Production remains NO_GO.

> Latest checkpoint: [v86 reviewed-original recovery and verified backfill](precision-reviewed-originals-v86-20260916.md). All 970 sources audited: 687 with employment / 1,997 rows; 283 remain unresolved. Seven originals were backfilled with 59 verified rows and five existing search indexes rebuilt; 1,216 fields passed readback and the other 963 candidates are unchanged. Overlap flags are 57 (two additional source-supported concurrent histories); malformed, duplicate and invalid-range counts remain zero. Local four-page OCR was reviewed, but deployed OCR and authenticated exact-artifact acceptance remain outstanding. Production remains NO_GO. Historical no-write statements below do not describe this batch.

> Latest code batch: [v85 labelled career records](precision-labelled-career-records-20260916.md). Full read-only comparison of 970 sources: eight previously empty sources recover 23 rows, and one existing truncated title is corrected. Current projection: 677 sources / 1,928 rows; 293 sources remain unresolved. All 1,904 other prior tuples are unchanged. Malformed/duplicate/invalid-range counts remain zero, overlap flags 55 and client/employer equality flags two. No new database write; production remains NO_GO.

> Previous correction: [v84 career row ownership correction](precision-career-row-ownership-20260916.md). Source review found cross-row date/title joins and project clients in v83 output despite green CI. The corrected read-only 970-source projection is 669 sources / 1,905 rows; 301 sources require review. Across 18 changed sources, 39 unsafe or superseded tuples are removed and five corrected/source-owned tuples added. Overlap flags fall from 60 to 55. Earlier v83 recovery/overlap claims are superseded as accuracy evidence. No new database write; production remains NO_GO.

> Historical code batch: [v82 interleaved career records](precision-interleaved-career-batch-20260916.md). All 970 sources compared: 27 previously empty sources recover 61 employment rows; all 1,796 prior tuples remain unchanged. Local totals: 650 sources / 1,857 rows, with 320 sources unresolved. Malformed, duplicate and invalid-range counts remain zero; overlap flags remain 55 and client/employer equality flags remain two. Plural project-section boundaries now prevent project dates from leaking into employment. No additional production data write.

> Previous code batch: [v76 career export recovery](precision-career-export-batch-20260916.md), checked against all 970 sources: 74 additional records recovered, 224 net additional employment rows, 484 sources still unresolved locally. This batch does not add production database writes; the verified nine-original backfill below remains the last data change.

> Current checkpoint (2026-09-16): [full 970-source audit and verified backfill](precision-full-population-audit-20260916.md). All 970 stored sources have been audited automatically. After explicit production confirmation, nine reviewed originals and their search indexes were backfilled atomically and read back successfully: 412 records / 1,267 employment rows, with 558 sources still requiring review. The other 961 candidates are unchanged. Continuous same-employer SAP periods include time between projects. Live OCR and authenticated exact-artifact acceptance remain outstanding. Historical scope/count/policy statements below do not override this checkpoint.

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

The precision feature branch previously triggered only the immutable-action-reference workflow. Production Trust CI now includes `codex/precision-*` pushes and pull requests targeting `codex/profile-source-recovery`, retaining all existing security, dependency, secret-history, formatting, build and regression gates. Eleven source-layout/OCR, career-date, deduplication and audit tests are included in its security-and-regression job.

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

## Continuation checkpoint: distinct partial end dates

Deduplication already preserved different starts when an end was missing, but lacked the corresponding protection for different ends when a start was missing. Two partial jobs ending one month apart could collapse to the first endpoint; a partial row could also overwrite the end of a complete row. Distinct known ends now remain separate whenever either start is unknown. Equal-end duplicates retain their existing merge behavior, and missing starts are not inferred. The canonical employment cache version is incremented.

Synthetic tests cover two end-only records, a partial/complete pair, both input orders, preservation of every explicit end and supported equal-end duplicates. All 16 local employment/calendar/canonical regression files and typecheck passed. Against commit `bce15bee2cf9aa10f91ce9d8b9e47a12abaa97e0`, the private 277-source comparison found zero changed employment timelines or experience summaries: 80 profiles / 315 rows, 197 unresolved, and zero malformed, duplicate or invalid-range employment diagnostics. No source or database records were changed.

The preceding revision passed Production Trust run `35042774606`, immutable-action run `35042774603` and both previews. This revision requires its own exact-head CI. Live OCR, reviewed backfill, the remaining 693 sources and authenticated exact-artifact acceptance remain release blockers (NO_GO).

## Consolidated precision and audit review

The employment deduplication rule now preserves conflicting explicit month endpoints, different normalized titles, undated records alongside dated engagements, and current versus historical assertions. The old one-month and title-token similarity tolerances could erase short jobs or promotion boundaries. Matching month representations and consistent partial records with a shared date still merge. The existing complementary-partial protections remain. The canonical employment version is incremented.

The read-only source audit now includes `cv_text`, uses validated canonical date ranges (including current jobs with known starts) for completeness and review status, and preserves the declared full population when re-exporting a subset. Previously it could incorrectly label current jobs incomplete or shrink the declared population on a second export. Two new mandatory CI regressions cover the consolidated deduplication contract and an actual synthetic audit/export/re-import round trip. The source-layout/audit/OCR CI group now contains eleven test scripts.

Local validation: 18 employment/calendar/canonical/audit regression scripts, six source-layout/OCR/upload scripts (one overlaps the employment group), TypeScript typecheck, scoped formatting and whitespace checks passed. The deduplication comparison against `820649a8e12104c33960f2b92e4600de38d299d7` changed zero employment timelines or experience summaries in the private 277-source subset.

The full read-only audit of the available subset reports 80 profiles / 315 employment rows and 197 unresolved employment sections. Of those rows, 315 have employers, 276 have titles and 313 have supported date ranges. Seven profiles have overlapping ranges and one has an employer/client equality flag; these are review signals, not adjudicated errors. Nine profiles have incomplete employment fields. Malformed employment, duplicates, invalid ranges and project pagination leakage remain zero. Scope is explicitly SUBSET_ONLY: 277 of a declared 970 sources, with 693 unaudited. Original-file recovery is not added to these counts.

This checkpoint completes the reproduced code defects in this review, not production acceptance. The remaining work is concrete: resolve the 197 source-review cases, inspect the seven overlap and one employer/client flags, audit the remaining 693 sources, run live Google OCR and verify saved provenance, apply only reviewed/version-matched backfill, then run authenticated acceptance on the exact artifact to promote. No runtime configuration, source mutation, database writes or production promotion were performed. Production remains NO_GO; exact-head CI is required for this revision.

## Batch checkpoint: flattened employment evidence (2026-09-16)

Baseline: `b85b760a8f2cfaa0537d7ab602ca3b320ebe1d2f`; parser now `candidate-employment-v59-flattened-evidence-batch`. This batch addresses unresolved source coverage rather than another isolated precision-only change. It reads explicit employment statements in both employer/role orders, delimiter-bounded employment headings, consecutive date-first career tables, and explicit Employer/Organization tenure before project fields. Employer-only evidence retains a blank title. Day precision is retained, repeated identical employer tenures are collapsed, and a failed table cell cannot consume the next row. Project/client dates and project roles remain outside employment evidence.

A read-only comparison of the unchanged private export found **80 → 90 profiles with employment**, **315 → 336 employment rows**, and **197 → 187 profiles without employment**. Exactly ten previously unresolved profiles gained rows; the existing 80 profiles' employer/title/date/current tuples are unchanged and no existing tuples were removed. New rows were checked against their source excerpts. The new coverage comprises two statement profiles (three rows), four delimited-heading profiles (four rows), two dated-ledger profiles (nine rows), and two explicit-employer-tenure profiles (five rows, including two intentionally blank titles).

The full subset audit reports 336 employers, 295 titles and 334 supported date ranges. Malformed, duplicate and invalid-range diagnostics and pagination leaks are zero. Seven overlap flags and one employer/client equality flag are unchanged and still require review. This is **SUBSET_ONLY: 277 / 970**, with 693 sources unaudited; it is not a database backfill or complete-profile acceptance.

`node --import tsx scripts/classifyEmploymentSourceGaps.ts --input <private-export.json>` now provides a repeatable, local-only aggregate inventory with no candidate identifiers, filenames, source excerpts or contact details. Its mutually exclusive queues are screening heuristics, not adjudicated root causes. Priority is headed tables, explicit employer labels, near-heading dates, then narrative/project signals; reference sections are excluded.

| Review queue                                            |  Before |   After |
| ------------------------------------------------------- | ------: | ------: |
| Date near an employment heading; boundary review needed |     132 |     125 |
| Project/client narrative; employment evidence needed    |      47 |      47 |
| Explicit employer labels; field review needed           |       9 |       7 |
| Explicit table headings; layout review needed           |       7 |       6 |
| Other narrative/layout review                           |       2 |       2 |
| **Total without employment**                            | **197** | **187** |

Next coverage work should examine the remaining 125 near-heading-date sources in groups; these include mixed project/employment sections and lost column boundaries, so a nearby date alone is not sufficient. Six table sources require layout-aware review; seven labelled sources require field-boundary review. Do not infer a missing end, copy client dates, or increase coverage by converting project-only evidence to employment. Recover originals through existing private access where possible; keep any original-source request list private and consolidated.

Validation: 24 employment/calendar/canonical/source-layout/OCR/upload regression files and TypeScript typecheck pass locally. The new batch regression is required in Production Trust CI (the source-layout/audit/OCR group now has twelve scripts). Exact-head GitHub CI and commit statuses must be checked after publishing this commit; local checks do not establish deployment acceptance. Production remains **NO_GO** pending live Google OCR with saved provenance, reviewed/version-matched backfill, audit of all 970 sources, and authenticated acceptance on the exact deployment artifact. No runtime configuration, Supabase/Vercel writes, source mutation or production promotion occurred.

## Batch checkpoint: bounded heading fields (2026-09-16)

Baseline: `23430b903c71706cf14688850c3461523325adee`; parser now `candidate-employment-v60-heading-fields-batch`. The complete unresolved inventory was rerun before editing: 187 source records, including 125 with a date near an employment heading. This queue was prioritized because several recurring layouts retain explicit employer/role boundaries despite flattened whitespace.

The batch supports legal-employer headings with tenure before or after the employer, labelled Position fields with intervening location text, consecutive employer/tenure/parenthesized-role rows, and COMPANY/POSITION/DURATION fields with explicit current endpoints. Roman numbering is removed only when repeated headings establish an ordered I/II sequence; company initials such as X or IV remain intact. A date-first pipe ledger with no title column and a numbered employer tenure before a project section retain blank titles. Invalid dates, date-only cells, project/client substitutions, narrative-as-title text and unbounded continuations remain excluded.

Private source comparison: **90 → 100 profiles with employment**, **336 → 357 rows**, **187 → 177 without employment** across the unchanged 277-source subset. Exactly ten previously unresolved source records gained employment; no existing employer/title/date/current tuples were removed or changed. Eight sources gained fourteen rows from bounded heading fields; one gained six employer-only ledger rows; one gained a single employer tenure before a project block. The seven employer-only rows intentionally have no title. All added tuples were checked against their private source excerpts. These counts describe source records, not deduplicated people or fully recovered CVs.

The full read-only audit reports 357 employers, 309 titles and 355 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. The seven overlap review flags and one possible employer/client equality flag are unchanged. No dates were inferred, source records mutated or database rows backfilled.

| Remaining review queue       |  Before |   After | Continuing reason                                                                         |
| ---------------------------- | ------: | ------: | ----------------------------------------------------------------------------------------- |
| Date near employment heading |     125 |     115 | Mixed narrative, missing delimiters or lost column order; proximity alone is insufficient |
| Project/client narrative     |      47 |      47 | Employer tenure cannot be established from assignment dates                               |
| Explicit employer labels     |       7 |       7 | Labels remain separated from their own dates or roles by mixed content                    |
| Headed tables                |       6 |       6 | Original layout or bounded row reconstruction still needed                                |
| Other narrative/layout       |       2 |       2 | No supported extraction added in this batch                                               |
| **Total**                    | **187** | **177** | Heuristic review queues, not adjudicated causes                                           |

Twenty-four local regression files, TypeScript typecheck and formatting checks pass. Representative positive and negative fixtures extend the existing mandatory flattened-employment CI regression; no release gate was relaxed. Before another batch, inspect the current PR head and exact-head CI/status results rather than reusing the baseline SHA. Continue grouping the 115 boundary-review records, and review the six remaining table layouts together. Original-source requests must use actual private metadata and exclude files still accessible locally.

Scope remains **SUBSET_ONLY: 277 / 970**, with 693 unaudited. Production remains **NO_GO** pending live OCR with saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance of the exact deployment artifact. No runtime configuration, Supabase/Vercel writes or production promotion occurred. Exact-head GitHub CI is required for this revision.

## Batch checkpoint: repeated employment forms (2026-09-16)

Baseline: `f13cf641f64458748198051280a4b359b7af8bf7`; parser now `candidate-employment-v61-labelled-forms-batch`. The complete 177-record unresolved inventory was examined before editing. Three evidence groups were selected: explicitly labelled employer/position/tenure forms, Period/Company/Designation forms, and direct worked-with/since/from assertions with their own date ranges. The first group also revealed substantial missing historical rows in sources whose first employment had already been extracted.

Uppercase COMPANY/POSITION/DURATION fields are read across repeated forms in an employment section, including intervening page furniture. Complete adjacent labels are required; partial fields cannot consume the next form or borrow a project duration. Current/Previous Employment or Position plus Company/Position/Service Period are also supported. Period/Company/Designation titles end at a bounded responsibility verb. Direct employment assertions preserve empty titles instead of borrowing project roles. Joined named-month/four-digit-year tokens retain their stated precision. Academic research-student/degree entries are excluded; explicitly labelled internships remain distinct source assertions. Representative fixtures use fictional organizations and cover project-only contexts, malformed forms, invalid chronology, missing dates and incomplete-row isolation.

Private comparison of all 277 available sources: **100 → 104 sources with employment**, **357 → 425 rows**, **177 → 173 sources without employment**. Ten source records gain 68 rows: seven uppercase-form sources gain 56 rows, one service-period form gains three, one period/company/designation source gains four, and one direct-tenure source gains five intentionally untitled rows. Four previously unresolved sources gain 25 rows; six already partially extracted sources gain 43 historical rows. All previous employer/title/start/end/current tuples remain present and unchanged. Added rows were checked against private source excerpts. These are source-record counts, not unique people or full-profile acceptance.

Read-only audit: 425 employers, 372 titles and 423 supported date ranges. Malformed, duplicate and invalid-range diagnostics remain zero; seven overlap flags and one possible employer/client equality flag are unchanged and remain review signals. No database backfill or original-file replacement was performed.

| Remaining review queue       |  Before |   After | Continuing reason                                                          |
| ---------------------------- | ------: | ------: | -------------------------------------------------------------------------- |
| Date near employment heading |     115 |     112 | Mixed narrative, incomplete field boundaries or lost column order          |
| Project/client narrative     |      47 |      46 | Assignment dates do not prove employer tenure; one explicit form recovered |
| Explicit employer labels     |       7 |       7 | Own dates/roles remain separated by mixed content                          |
| Headed tables                |       6 |       6 | Original layout or bounded row reconstruction required                     |
| Other narrative/layout       |       2 |       2 | Insufficient supported extraction                                          |
| **Total**                    | **177** | **173** | Heuristic queues, not adjudicated root causes                              |

Twenty-four local regression files, TypeScript typecheck and formatting pass. The expanded regression remains mandatory in CI. Check the latest PR head and exact-head CI/status results before continuing; the baseline SHA is not evidence for this revision. Prioritize remaining labelled/table groups and source-backed boundary groups, and measure missing historical rows as well as completely unresolved sources. Keep any original-source request list private and do not request files still accessible.

Scope remains **SUBSET_ONLY: 277 / 970**, with 693 unaudited. Production remains **NO_GO** pending live OCR with saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance on the exact deployment artifact. Exact-head GitHub CI is required after this commit. No runtime configuration, Supabase/Vercel writes or production promotion occurred.

## Batch checkpoint: explicit career dates and labelled histories (2026-09-16)

Baseline: `f7f6d00a6f89585b5c2a677668191f0cb9a1f5b1`; parser now `candidate-employment-v62-explicit-career-dates-batch`. All 173 unresolved records were classified before editing: 112 near-heading-date cases, 46 project/client narrative cases, seven employer-label cases, six headed tables and two other cases. The seven label cases and six table cases were reviewed together. Three label cases had complete adjacent evidence that could be recovered without reconstructing lost columns; the other label/table cases remain unresolved.

Named-month date parsing now accepts explicit year/month order, month/day/year order and separated ordinal suffixes, retaining the stated day or month precision. No two-digit year or missing endpoint is inferred. Company Name/Title/Date Joined/Date Left forms are bounded at the next company or project-history section; duties can intervene between the joined and left fields. Multiple competing joined/left labels and invalid complete ranges are rejected. A missing end year retains only the explicit start and does not assert current employment. Career Profile employer/job-title forms accept duration-count annotations but reject an intervening additional date. Professional Profile organization/role/duration forms require contiguous fields and exclude explicit project-role records. Parenthesized title decoration is normalized without inventing a role. Quoted employer statements remain owned by the dedicated parser so trailing locations cannot create duplicate employers.

Private comparison of all 277 available sources: **104 → 107 sources with employment**, **425 → 450 rows**, **173 → 170 sources without employment**. Exactly three previously unresolved records changed: nine joined/left rows, nine career-profile rows and seven professional-profile rows. Twenty-four added rows have complete supported ranges; one retains an explicit start and an unknown end. All 425 previous company/title/start/end/current tuples are unchanged and retained. Added rows were checked against the private source text. Source-record counts are not unique people or complete CV acceptance; one career record with an ambiguous extra date remains unassigned.

Read-only audit: 450 employers, 397 titles and 447 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. Seven overlap review flags and one possible employer/client equality flag are unchanged. The newly retained partial row still requires source review; absence of diagnostic errors is not full-profile acceptance.

| Remaining review queue       |  Before |   After | Continuing reason                                                        |
| ---------------------------- | ------: | ------: | ------------------------------------------------------------------------ |
| Date near employment heading |     112 |     112 | Mixed narrative, missing delimiters or lost reading order                |
| Project/client narrative     |      46 |      46 | Assignment dates cannot establish employer tenure                        |
| Explicit employer labels     |       7 |       4 | Missing own tenure, mixed assignment context, or lost text boundaries    |
| Headed tables                |       6 |       6 | Column-major text, partial dates or original layout still require review |
| Other narrative/layout       |       2 |       2 | No supported extraction added                                            |
| **Total**                    | **173** | **170** | Heuristic queues, not adjudicated causes                                 |

Twenty-four regression files, typecheck, formatting and whitespace checks passed locally. Synthetic fixtures cover day precision, year-first dates, invalid dates, missing years, competing labels, cross-company/project isolation and coexistence with the existing quoted-employer reader. These extend the mandatory flattened-employment CI regression. Verify exact-head CI/status results after publishing and start future work from the latest PR head. Remaining work should focus on the actual boundary/table queues and partial-history coverage, without inferring dates or converting project-only text to employment.

Scope remains **SUBSET_ONLY: 277 / 970**, with 693 unaudited. Production remains **NO_GO** pending live OCR with saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance on the exact deployed artifact. No runtime configuration, Supabase/Vercel writes, source mutation, backfill or production promotion occurred.

## Batch checkpoint: bounded legal-employer headings (2026-09-16)

Baseline: `981a00a3d65c4657bdd0adb18f5a61383136cbbb`; parser now `candidate-employment-v63-legal-heading-batch`. The full 170-record unresolved inventory was rerun before editing: 112 heading-boundary cases, 46 project/client narrative cases, four labelled-field cases, six table cases and two other cases. This batch targets recurring heading-boundary layouts with explicit legal suffixes or delimiters, rather than arbitrary date proximity.

At the start of an employment section, a legal-employer boundary supports employer/role/date and role/employer/date orders. Comma-delimited location text is excluded from the employer when the legal suffix is explicit, and project/client or role text cannot act as location. Separate employer-tenure readers handle a pipe before dates, numbered roles/promotions after employer tenure, a bounded location heading, and employer tenure before an explicit Project Description. These retain blank titles rather than copying later project or promotion roles. The existing prose reader retains ownership of dash-separated employer/title headings to avoid duplicate role variants. Invalid dates, reversed ranges, missing endpoints and project-only contexts remain excluded.

Private comparison across all 277 available sources: **107 → 116 sources with employment**, **450 → 460 rows**, **170 → 161 sources without employment**. Exactly nine previously unresolved sources gain ten rows: four role-bearing heading sources gain four rows; five employer-tenure sources gain six rows. Six added rows intentionally have no title; source review remains necessary to establish title/tenure associations. All ten added ranges are explicit, and all 450 previous company/title/start/end/current tuples remain unchanged and retained. New rows were checked against private source excerpts. These are source-record counts, not unique people or complete CV acceptance.

Read-only audit: 460 employers, 401 titles and 457 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. Seven overlap flags and one possible employer/client equality flag are unchanged. Newly retained employer-only rows still require incomplete-field review; diagnostic PASS is not complete-profile acceptance.

| Remaining review queue       |  Before |   After | Continuing reason                                         |
| ---------------------------- | ------: | ------: | --------------------------------------------------------- |
| Date near employment heading |     112 |     103 | Missing delimiters, mixed narrative or lost reading order |
| Project/client narrative     |      46 |      46 | Assignment dates do not establish employer tenure         |
| Explicit employer labels     |       4 |       4 | Missing tenure or mixed assignment fields                 |
| Headed tables                |       6 |       6 | Original layout or bounded column reconstruction needed   |
| Other narrative/layout       |       2 |       2 | No supported extraction added                             |
| **Total**                    | **170** | **161** | Heuristic queues, not adjudicated causes                  |

Twenty-four local regression files, typecheck, formatting and whitespace checks pass. The mandatory flattened-employment regression now covers each new heading order, location exclusion, distinct promotion/project dates, missing/reversed endpoints and coexistence with the older prose parser. A duplicate identified by the existing prose regression was repaired locally before publishing; no regression expectations or release gates were weakened. Verify CI and commit statuses on this revision, and always inspect the latest PR head before continuing. Prioritize evidence-backed heading/table groups and missing historical rows; keep original-source requests private and avoid requesting available files.

Scope remains **SUBSET_ONLY: 277 / 970**, with 693 unaudited. Production remains **NO_GO** pending live OCR and saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance on the exact artifact to promote. No source mutation, runtime configuration, Supabase/Vercel writes, backfill or production promotion occurred.

## Batch checkpoint: bounded employment tables and dated ledgers (2026-09-16)

Baseline: `c13c672971f7596c5be5d76dfc8a6ad9587c2591`; parser now `candidate-employment-v64-bounded-table-batch`. The entire 161-source unresolved inventory was classified before edits: 103 heading/date-boundary cases, 46 project/client narratives, four labelled-field cases, six headed tables and two other cases. Three source-backed layout families were selected, including historical rows in an already partially recovered source.

- Explicit Date / Company Name / Role tables now recognize the literal current endpoint "Till date" and bounded generic role cells. Generic titles must occupy the complete trailing cell; role words inside an employer name cannot create a split. Academic and Skills headings terminate the table. The existing two-digit-year convention is unchanged.
- Explicit Position / Company / Period tables retain year-only tenure exactly as written, without inventing months. Complete cells must be consecutive and contain one legal-employer boundary; separated column-major lists and concatenated employers are rejected.
- Compact date-range / employer / location / role ledgers consume adjacent complete cells only. Location stays out of the employer, seniority stays in the title, and a project/client boundary or incomplete cell stops the ledger rather than restarting in later narrative.

All 277 private sources were compared: **116 → 120 sources with employment**, **460 → 483 rows**, and **161 → 157 sources without employment**. The two date/company/role table sources gain ten rows (seven from a previously unresolved source and three older jobs from a partially recovered source); the year-only table gains three rows; two source versions with dated ledgers gain ten rows. All 460 previous company/title/start/end/current tuples are unchanged and retained. All 23 added rows were checked against private excerpts. Source versions are not unique people, and these gains do not establish complete-CV acceptance.

Read-only audit: 483 employers, 424 titles and 480 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. Seven overlap flags and one possible employer/client equality flag are unchanged; these are review signals, not adjudicated errors. Missing fields and original layout ambiguity still require source review.

| Remaining review queue       |  Before |   After | Continuing reason                                                    |
| ---------------------------- | ------: | ------: | -------------------------------------------------------------------- |
| Date near employment heading |     103 |     100 | Mixed narrative, missing delimiters or lost reading order            |
| Project/client narrative     |      46 |      46 | Assignment dates do not prove employer tenure                        |
| Explicit employer labels     |       4 |       4 | Missing tenure or mixed assignment fields                            |
| Headed tables                |       6 |       5 | Column-major text, ambiguous column ownership or duration-only dates |
| Other narrative/layout       |       2 |       2 | No supported extraction added                                        |
| **Total**                    | **161** | **157** | Heuristic review queues, not adjudicated causes                      |

Twenty-four local regression files, typecheck, scoped formatting and whitespace checks passed. Sanitized tests cover each new family, year precision, current endpoints, seniority, title words in employer names, column-major rejection, reversed dates and project/narrative isolation. A role split and a concatenated-employer case were caught and corrected locally before publishing. No private source identifiers/text are committed and no release/test requirements were weakened. Verify exact-head CI and commit statuses after the single batch push; start subsequent work from the latest PR head.

Continuation: prioritize remaining source-backed layout groups and partial-history coverage. Five table cases still need bounded reconstruction or original-layout evidence; do not pair columns or infer tenure from duration counts. Consolidate any original-CV requests privately from actual metadata and do not request accessible files again.

Scope remains **SUBSET_ONLY: 277 / 970**, with 693 unaudited. Production remains **NO_GO** pending live OCR with saved provenance, reviewed/version-matched backfill, all-source audit and authenticated acceptance on the exact artifact to promote. No runtime configuration, Supabase/Vercel writes, source mutation, backfill or production promotion occurred.

## Batch checkpoint: dated legal-employer headings and numbered history (2026-09-16)

Baseline: `2999d0eb2df658d93d898974402253acb7c886d5`; parser now `candidate-employment-v65-dated-legal-heading-batch`. Before editing, all 157 unresolved sources were classified: 100 heading/date-boundary cases, 46 project/client narratives, four labelled-field cases, five headed tables and two other cases. Private source review selected dated legal-employer headings, role/date/employer headings with an explicit following field, and consecutive numbered employment histories. No company-name dictionaries or per-person rules were added.

The parser recognizes date/role/legal-employer and role/date/legal-employer orders only at a section start or an established numbered history. Numbering must begin at one and continue sequentially with the same delimiter; project-history/details sections terminate that enumeration. Explicit day precision is retained. A role/date/employer reader requires a following Skills/Responsibilities/Job Duties field to avoid linking a previous role's dates to the next employer. Legal-employer headings with location or alias text can retain independently supported tenure with a blank title. Existing readers retain ownership of already-supported headings, and an employer alias cannot become a title.

Comparison across all 277 private sources: **120 → 127 sources with employment**, **483 → 503 rows**, **157 → 150 sources without employment**. Two numbered-history sources gain 15 rows, a role/date/employer source gains one row, and four dated-employer sources gain four rows. Three added rows intentionally retain blank titles. All 483 prior company/title/start/end/current tuples remain unchanged and retained. Every added row was checked against private source excerpts. These source-record counts do not establish distinct-person counts or full-history completeness.

Read-only audit: 503 employers, 441 titles and 500 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. Seven overlap flags and one possible employer/client equality flag remain unchanged. Blank titles and other incomplete fields still need source review; diagnostic PASS is not complete-profile acceptance.

| Remaining review queue       |  Before |   After | Continuing reason                                                    |
| ---------------------------- | ------: | ------: | -------------------------------------------------------------------- |
| Date near employment heading |     100 |      94 | Unbounded role/company text, missing dates or lost reading order     |
| Project/client narrative     |      46 |      45 | Most assignment dates still do not establish employer tenure         |
| Explicit employer labels     |       4 |       4 | Missing tenure or mixed assignment fields                            |
| Headed tables                |       5 |       5 | Column-major text, ambiguous column ownership or duration-only dates |
| Other narrative/layout       |       2 |       2 | No supported extraction added                                        |
| **Total**                    | **157** | **150** | Heuristic review queues, not adjudicated causes                      |

Twenty-four local regression files and typecheck passed, with scoped formatting and whitespace checks. Sanitized fixtures cover numbered history, day precision, contract annotations, role/date order, location/alias exclusion, missing or reversed dates, project isolation and adjacent-job ownership. Full-source comparison caught duplicate reader output and a potential cross-employer role/date association; both were corrected locally before publishing. No regression expectations or release gates were lowered. Verify exact-head CI and statuses after the batch push.

Continuation: inspect the latest PR head, prioritize remaining evidence-backed layout groups and partial-history coverage, and compare all sources before publishing. Keep requests for original CVs private and consolidated from actual metadata; do not ask for files still accessible. The remaining 150 unresolved sources and 693 unaudited sources are separate populations.

Production remains **NO_GO**. Scope is still **SUBSET_ONLY: 277 / 970**. Live OCR with saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance on the exact artifact to promote remain required. No private source identifiers or CV text are committed; no runtime configuration, Supabase/Vercel writes, backfill or promotion occurred.

## Batch checkpoint: compact consecutive employment histories (2026-09-16)

Baseline: `9d70cf13c06e10fb6faadf2d04386c2b86c71215`; parser now `candidate-employment-v66-compact-history-batch`. Before editing, the full 150-source unresolved inventory was classified into 94 heading/date-boundary cases, 45 project/client narratives, four labelled-field cases, five headed tables and two other cases. Private review selected adjacent employer/role/tenure cells, repeated employment headings and explicit date/role/"at"/employer ledgers.

Compact employer/role/tenure cells are consumed from the start of an employment section and must remain consecutive. Recognizable role phrases define the role boundary; a seniority word alone cannot become an employer. Table headers remain owned by their existing readers. Parsing stops at responsibility prose instead of searching ahead for another date or company. The inverse ledger requires an explicit "at" and complete per-cell tenure. Location is excluded from the employer at a comma boundary. A later unrecognized date stops parsing without contaminating the preceding complete cell; the parser does not guess a misspelled month or a current endpoint. Year-only starts retain their source precision.

Comparison across all 277 private sources: **127 → 133 sources with employment**, **503 → 522 rows**, **150 → 144 sources without employment**. A consecutive company/role ledger gains six rows, repeated commercial-role headings gain five, an explicit "at" ledger gains five, and three other bounded headings gain one row each. All 19 additions have a source-supported company, title and tenure; every added tuple was checked against private excerpts. All 503 prior company/title/start/end/current tuples remain unchanged and retained. These source counts are not unique-person counts or complete-history acceptance. In particular, the explicit "at" source still contains an unresolved malformed date after its five recovered rows.

Read-only audit: 522 employers, 460 titles and 519 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. Seven overlap flags and one possible employer/client equality flag are unchanged. Existing incomplete fields and review signals remain outstanding.

| Remaining review queue       |  Before |   After | Continuing reason                                                    |
| ---------------------------- | ------: | ------: | -------------------------------------------------------------------- |
| Date near employment heading |      94 |      88 | Missing boundaries, malformed dates or lost reading order            |
| Project/client narrative     |      45 |      45 | Assignment dates do not establish employer tenure                    |
| Explicit employer labels     |       4 |       4 | Missing tenure or mixed assignment fields                            |
| Headed tables                |       5 |       5 | Column-major text, ambiguous column ownership or duration-only dates |
| Other narrative/layout       |       2 |       2 | No supported extraction added                                        |
| **Total**                    | **150** | **144** | Heuristic review queues, not adjudicated causes                      |

Twenty-four regression files, typecheck, scoped formatting and whitespace checks pass locally. Tests cover complete adjacent-job ownership, repeated headings, year precision, explicit "at" boundaries, location exclusion, malformed-date stopping, project/narrative isolation and role-only headings. A formerly unsupported adjacent-job fixture now asserts both exact employer/title/date tuples instead of zero rows; the forbidden cross-employer association remains excluded. Existing table regressions caught an attempted second reading of a headed table, which was repaired locally before publishing. No release conditions or privacy requirements were reduced. Verify exact-head CI and statuses after the single batch push.

Continuation: start from the latest head, prioritize remaining evidence-backed source groups and partially recovered histories, and keep comparing all 277 sources. The 144 unresolved records are separate from the 693 sources not yet audited. Consolidate any original-CV requests privately from actual metadata and do not request available files again.

Scope remains **SUBSET_ONLY: 277 / 970**. Production remains **NO_GO** pending live OCR with saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance on the exact artifact to promote. No CVs or private identifiers are committed; no runtime configuration, Supabase/Vercel writes, source mutation, backfill or promotion occurred.

## Batch checkpoint: explicit forms, duration tables and private review inventory (2026-09-16)

Baseline: `099c18bdac42bf67624b13e8d2fb45ec29dcfcd2`; parser now `candidate-employment-v67-explicit-form-table-batch`. Before edits, all 144 unresolved source records were classified: 88 heading/date-boundary, 45 project/client narratives, four explicit-label, five table and two other cases. This batch addresses four source-backed layouts without company dictionaries or personal fixtures.

- Explicit Professional History / Period / Position / Company / Duration tables consume consecutive complete rows. The trailing duration marks the row boundary, never supplies a missing endpoint. Quoted short years use the existing date convention only inside this table. Embedded extra dates, incomplete cells and duty prose stop parsing; the reader does not restart later in a narrative.
- Time Duration / Position / Company's Name / Field of Work forms bind complete adjacent fields. Nested project Duration and Position cannot complete missing employer fields. Repeated employment forms retain their own dates and titles, including year-only endpoints. Educational history, project-history sections and labelled references stop the form reader. A customer-reference mention within duties does not prematurely discard later employment forms.
- A literal `(current)` or `(present)` beside the employer start establishes the current endpoint only when followed by an explicit Role field.
- Legal-employer / location / tenure / Designation headings keep the location outside the employer and stop before the following numbered project. Project dates never supply employer tenure.

All 277 private sources were compared: **133 → 137 source records with employment**, **522 → 539 employment rows**, **144 → 140 without employment**. Repeated forms recover nine rows, the duration-headed table recovers six rows, and two explicit headings recover one each. All 522 previous company/title/start/end/current tuples are unchanged and retained. Every added tuple was checked against private excerpts. These are source-record counts, not unique people or complete histories: the table still contains an unsupported older role, and one newly recovered heading has older jobs awaiting bounded extraction.

Read-only audit: 539 employers, 477 titles and 536 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. The possible client/employer equality flag stays at one. Overlap flags increase **seven → eight** because the newly recovered form explicitly includes a part-time job overlapping another job. Both source-supported ranges are retained and the review flag remains visible; this is not counted as a new erroneous range or silently resolved.

| Remaining review queue       |  Before |   After | Continuing reason                                                   |
| ---------------------------- | ------: | ------: | ------------------------------------------------------------------- |
| Date near employment heading |      88 |      85 | Lost order, missing delimiters or malformed dates                   |
| Project/client narrative     |      45 |      45 | Assignment dates alone cannot establish employer tenure             |
| Explicit employer labels     |       4 |       4 | Incomplete or mixed assignment fields                               |
| Headed tables                |       5 |       4 | Column-major order, missing endpoints or ambiguous column ownership |
| Other narrative/layout       |       2 |       2 | No supported extraction added                                       |
| **Total**                    | **144** | **140** | Heuristic review queues, not adjudicated causes                     |

A separate private inventory consolidates seven requests for original/layout evidence, two requests for date confirmation and two apparent non-candidate records (a JD and an empty template) requiring classification review. No deletion or data correction occurred. Eight original-CV identities already accessible were excluded from re-upload requests; this is an availability check, not a claim that all those originals passed extraction or backfill. Names, metadata, contact details, source tokens and private file links are deliberately absent from this repository.

Twenty-four regression files and typecheck pass locally. Sanitized fixtures cover all four new layouts, short/year-only date precision, explicit current markers, project/client isolation, incomplete/reversed dates, consecutive-cell ownership and stopping at education/references. A column-major negative fixture caught an extra date inside a role cell; the parser now rejects it. Scoped formatting and whitespace checks pass. Verify exact-head CI and commit statuses after this single batch push; no release or test gates were lowered.

Continuation: start from the latest PR head. Prioritize remaining source-backed groups and partially recovered histories while the private request list is being answered. Keep the **140 unresolved subset sources** separate from **693 unaudited sources**; do not invent names for the latter. The nine-profile request list is a priority evidence list, not an exhaustive list of all unresolved sources.

Scope remains **SUBSET_ONLY: 277 / 970**. Production remains **NO_GO** pending real OCR with saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance on the exact artifact to promote. No runtime configuration, Supabase/Vercel writes, source mutation, backfill or promotion occurred.

## Batch checkpoint: punctuated employment headings (2026-09-16)

Baseline: `2fd8cd7790259d14ac3b455f5924675fd51ad287`; parser now `candidate-employment-v68-punctuated-heading-batch`. Before edits, all 140 unresolved source records were classified: 85 heading/date-boundary cases, 45 project/client narratives, four explicit-label cases, four headed tables and two other cases. Private source review selected seven records whose employment rows retain explicit punctuation or labelled placement boundaries after PDF flattening.

- Date / role / employer rows require commas plus either a legal company suffix or an explicit contract annotation. Legal suffix matching retains compound endings such as `Corporation Berhad`; project names after the employer cannot become part of the company.
- Role / tenure / pipe / employer rows reject page furniture and responsibility prose before the role. A role must start after the boundary and contain a recognizable job term.
- Role / legal employer / location / year-only tenure rows preserve year precision. The role ends at its last supported job term before the legal employer, preventing role fragments from moving into the employer or vice versa.
- Employer / visible-symbol / tenure / role rows accept only the first complete row at the employment-section boundary. Parenthesized office descriptors and locations are excluded from the employer.
- Explicit placement annotations remain client context. Only the legal employer before the annotation receives the role and tenure. A single uppercase `EMPLOYMENT` or `EXPERIENCE` heading is recognized only when it is not part of an existing Project, Work, Working or Professional heading.
- Employer / location / tenure / role headings and parenthesized role / employer / location / tenure headings require all fields in one bounded heading. No missing endpoint is inferred.

Comparison across all 277 private sources: **137 → 144 source records with employment**, **539 → 552 rows**, and **140 → 133 without employment**. The seven recovered records add 13 rows: four rows from a comma-delimited employment history, three year-only rows, two pipe-delimited rows and four other fully bounded headings. All 539 prior company/title/start/end/current tuples remain unchanged and retained. Every new tuple was checked against private source excerpts. Source-record counts are not unique people or complete-history acceptance; some recovered records still contain older rows whose ownership is not sufficiently bounded.

Read-only audit: 552 employers, 490 titles and 549 supported date ranges. Malformed, duplicate, invalid-range and pagination-leak counts remain zero. Eight overlap flags and one possible employer/client equality flag are unchanged from the baseline; they remain review signals rather than adjudicated errors. No project/client date was promoted to employer tenure.

| Remaining review queue       |  Before |   After | Continuing reason                                                   |
| ---------------------------- | ------: | ------: | ------------------------------------------------------------------- |
| Date near employment heading |      85 |      78 | Lost order, missing delimiters, malformed dates or unbounded prose  |
| Project/client narrative     |      45 |      45 | Assignment dates alone cannot establish employer tenure             |
| Explicit employer labels     |       4 |       4 | Incomplete or mixed assignment fields                               |
| Headed tables                |       4 |       4 | Column-major order, missing endpoints or ambiguous column ownership |
| Other narrative/layout       |       2 |       2 | No supported extraction added                                       |
| **Total**                    | **140** | **133** | Heuristic review queues, not adjudicated causes                     |

Twenty-four regression files, typecheck, scoped formatting and whitespace checks pass locally. Sanitized fixtures cover comma, pipe, symbol, placement, location and year-only families; compound legal suffixes; page-header exclusion; incomplete/reversed dates; and project/client isolation. Full-source comparison confirms that no previous tuple was removed or changed. Verify exact-head CI and commit statuses after the single batch push; no release or test gate was weakened.

Continuation: start from the latest PR head and exact-head checks. Prioritize the remaining source-backed groups and partially recovered histories while awaiting the consolidated original-CV/date confirmations. Keep the **133 unresolved subset records** separate from **693 unaudited sources**. Do not treat the private priority request list as an exhaustive list of all unresolved sources.

Scope remains **SUBSET_ONLY: 277 / 970**. Production remains **NO_GO** pending real OCR with saved provenance, reviewed/version-matched backfill, full-population audit and authenticated acceptance on the exact artifact to promote. No runtime configuration, Supabase/Vercel writes, source mutation, backfill or promotion occurred.

## Original-file batch checkpoint — 2026-09-16

Baseline `9f0d53e3cec910e506993fba69aba41c6ffdb8b0`; parser `candidate-employment-v69-original-layout-batch`. Before editing, all 133 unresolved export records were classified: 78 heading/date-boundary, 45 project/client-heavy, four explicit-label, four headed-table and two other cases. Newly supplied originals provided direct evidence for the table, sidebar and wrapped-date groups. This batch deliberately repairs native source extraction rather than guessing lost column associations from flattened exports.

Eight new original PDFs / 26 pages yield **1 → 35 employment rows**, **1 → 8 CVs with at least one row**. Three accompanying DOCX versions match their PDFs after case folding and are not double-counted. Start-only and undated roles retain missing endpoints; event years do not become tenure; a project-labelled table row remains unresolved. See `original-cv-layout-verification-20260915.md` for the per-layout counts and qualifications.

PDF sidebar ordering requires an explicit positioned employment heading and an independent sidebar section. Centered headings without a sidebar keep ordinary row ordering. DOCX table recovery uses the actual row/cell/paragraph structure and requires equal cardinality for multi-entry cells. Other rules bind complete line-bounded headings, numeric month/year dates, wrapped dates and explicit role-at-employer statements. `CURR` is a current marker; it does not establish an unrecognized starting month. Communications titles are no longer rejected merely because they start with `com`. A legacy untitled reading is merged only when a titled layout reading contains its exact heading evidence and has identical employer and complete dates/current state; both provenance references remain.

All 277 export sources were compared: **144 → 144 records with employment**, **552 → 552 rows**, **133 → 133 unresolved**. No company/title/start/end/current tuple changed or disappeared. Malformed, duplicate and invalid-range counts remain zero. Queue sizes remain 78 / 45 / 4 / 4 / 2 because original sources have not been written back. The other 693 population records remain unaudited. Original-file recovery is not a backfill or a population-audit claim.

Twenty-four regression files, typecheck, scoped formatting and whitespace checks pass locally. Synthetic positive/negative fixtures cover sidebar separation, centered-heading rejection, text retention, Word cell ownership, unequal-cell rejection, wrapped/shared-year dates, current markers, reversed dates, partial endpoints, references, project/client isolation and duplicate-heading evidence. Character-inventory comparison passes on every original PDF page, and all three PDF/DOCX pairs match. Verify exact-head CI and commit statuses after the batch push.

Private review notes record a recruiter-provided proposed year correction with the original reversed range retained, plus confirmation that a current abbreviation means ongoing employment. Neither note is an automatic correction rule or a database write. A misspelled month remains unresolved. Uploaded files for similarly named but different identities were reviewed separately. One requested original is still not supplied, and one older student CV does not substantiate its SAP filename/title. Those identities and file references stay private.

Continuation: retain and use the now-accessible original files; do not request them again. Keep the unresolved assignment/event records and missing-date flags rather than claiming full-history completion. Production stays **NO_GO** pending live OCR with saved provenance, reviewed/version-matched backfill, audit of all 970 sources and authenticated acceptance of the exact promoted artifact. No runtime configuration, Supabase/Vercel writes, data mutation, backfill or promotion occurred.

CI follow-up: the first batch commit failed the unchanged synthetic acceptance employment-count contract. The line-bounded role reader had also treated an already complete pipe-delimited employment heading as the next employer's title. The reader now rejects pipe-delimited lines and lines already containing a tenure. A focused regression asserts both exact jobs and prohibits the extra cross-employer record. The original acceptance fixture and its two-job assertion remain unchanged. Local verification includes all seven acceptance-harness regression files in addition to the 24 source/parser regressions; original-file extraction and the full 277-source comparison are repeated before the corrective push.

## Review-time tenure and supplied-table checkpoint — 2026-09-16

Baseline `3781c2ac545305b97ee719529de6da1bc325c82c`; parser `candidate-employment-v70-review-time-tenure`. The recruiter explicitly requested year-level tenure estimates when the year is known but the month is unresolved. A bounded employment row with year / unrecognized month / current marker / role-at-legal-employer now retains the known year and original excerpt. It does not guess a month, repair reversed ranges, or downgrade recognized future months. Year-only tenure displays an explicit estimate, calculated from the review year. Both profile employment views recalculate duration from endpoints when rendered, rather than trusting a cached duration string. Exact month dates keep month precision. This is employment-tenure presentation, not a new population audit or proof that an old current marker remains factually current.

The newly supplied five-page original contains four employment rows in a Period / Role / Industry / Description table. The reader binds the wrapped date and title only within that table, requires a legal employer in the description cell, and excludes client/project labels. All four rows were visually checked. A second supplied attachment is byte-identical to its earlier version and is not counted as a new source.

All 277 export sources were compared: **144 sources / 552 rows -> 144 sources / 553 rows**. The only added row has year precision; all 552 previous company/title/start/end/current tuples are retained. Malformed, duplicate and invalid-range counts remain zero. The 133 unresolved export sources retain the prior 78 heading/date-boundary, 45 project/client-heavy, four explicit-label, four headed-table and two other grouping. The original-file result is separate: **0 -> 4 rows**, with no export replacement or database backfill. The earlier eight-original cohort remains 35 rows; PDF/DOCX counterparts still match. Character retention passes on all 33 available PDF pages, including the duplicate attachment; this is not live OCR evidence.

Local validation includes all 31 regression files, typecheck, scoped formatting and whitespace checks. Regressions cover review-year changes, approximate versus month-precise tenure, unknown endpoints, future/reversed dates, retained typo evidence, table ownership, split titles and client/project rejection. Inspect the exact new head's CI/statuses before release. Private review notes now mark the requested original as received and the duplicate as unchanged; no personal identifiers or CV text are committed.

Production remains **NO_GO**: live OCR with persisted provenance, reviewed/version-matched backfill, audit of all 970 sources and authenticated exact-artifact acceptance remain outstanding. The other 693 sources are unaudited. No runtime configuration, Supabase/Vercel write, data mutation or production promotion occurred.

## Punctuated employment row batch — 2026-09-16

Baseline `c452a84b9e34b4cb2ad99524ddf4f0dae10a00d5`; parser `candidate-employment-v71-punctuated-row-batch`. Before editing, all 133 unresolved sources were classified into heuristic review queues: 78 heading/date-boundary, 45 project/client-heavy, four explicit-label, four headed-table and two other. These queues are screening categories, not adjudicated causes or evidence of full-history completeness.

Three source-backed families were repaired together: date / recognizable role / comma / employer bounded by a following duty sentence; numbered role-colon / legal employer / full dates / Responsibilities; and uppercase legal employer / parenthesized industry / dates / POSITION / bullet. Employer and role remain in their own fields. Role strings containing a legal company suffix are rejected, module/location prose is not absorbed into company, and client/project sections and reversed/impossible dates remain excluded. The explicit Customer Service Specialist title is allowed only in the labelled POSITION family; client labels do not gain a general exception.

| Family                              | Newly recovered source records | Employment rows |
| ----------------------------------- | -----------------------------: | --------------: |
| Dated role-comma-employer headings  |                              2 |               8 |
| Numbered title-colon-employer rows  |                              1 |               4 |
| Industry-labelled position headings |                              1 |               2 |

All 277 sources were compared against baseline: **144 -> 148 sources with employment**, **553 -> 567 rows**, **133 -> 129 without employment**. All 553 existing company/title/start/end/current tuples are unchanged; only the four previously unresolved sources gain rows. Malformed, duplicate and invalid-range counts remain zero. Baseline and final read-only audits both have nine overlapping-range review flags and one possible client/employer equality flag; neither increased. All 13 available original-file representations retain identical employment tuples. No source substitution or backfill occurred.

Remaining review queues: **74** heading/date-boundary, **45** project/client-heavy, **4** explicit-label, **4** headed-table and **2** other. In the newly recovered histories, shared-year internship rows, a title/module/employer boundary, an unrecognized end month and a tutor entry without an employer remain incomplete evidence. Recovering at least one row does not close a whole profile's review. A recruiter-confirmed sole available CV remains the accepted source; no replacement CV is required merely to support an unsubstantiated filename/title. Private review notes retain that instruction.

Local validation: 31 regression files, typecheck, scoped formatting, full-subset comparison, original-file comparison and whitespace checks pass. Sanitized positive/negative fixtures cover all three families, field ownership, client/project isolation, module/location rejection and chronological validation. Inspect CI and commit statuses on the new exact head after the batch push. Production remains **NO_GO** for live OCR/provenance, reviewed/version-matched backfill, full 970-source audit (693 still unaudited) and authenticated exact-artifact acceptance. No runtime configuration, data write or promotion occurred.

## Chronological employment ledger batch — 2026-09-16

Baseline `865d466c4f3bd584a4fea866292b3c19b5690de3`; parser `candidate-employment-v72-chronological-ledger-batch`. Before editing, the full unresolved inventory contained 129 source records: 74 heading/date-boundary, 45 project/client-heavy, four explicit-label, four headed-table and two other review cases. This batch targets nine source records with complete employer/title/tenure ownership in recurring chronological layouts; it does not search project prose for employment.

The supported layouts are date / colon / employer / role ledgers; employer / recognized city-country / role / tenure headings; role / tenure / legal employer rows; numeric `Employer / From MM-YYYY to MM-YYYY / role` forms; year tenure / legal employer / `Role` labels; SAP role rows bounded by a following Responsibilities label; and an explicit FREELANCER marker between role and tenure. Day values are reduced mechanically to the month precision already supported by the career model. Current markers remain source claims. Repeated current roles for the same employer retain only the latest row in this reader, avoiding a manufactured overlap. Reversed or missing ranges, project/client boundaries, description text inside employers and unsupported role/company splits remain excluded.

All 277 private sources were compared against the baseline: **148 -> 156 source records with employment**, **567 -> 586 employment rows**, and **129 -> 121 records without employment**. Nine source records gain 19 rows; one was already partially recovered and gains one historical row. All 567 existing company/title/start/end/current tuples remain unchanged. Malformed, duplicate and invalid-range counts remain zero. Overlap review flags remain nine and possible client/employer equality remains one. All 13 available original-file representations retain their previous 57 tuples; no original was substituted into the export.

| Remaining review queue       |  Before |   After | Continuing reason                                                    |
| ---------------------------- | ------: | ------: | -------------------------------------------------------------------- |
| Date near employment heading |      74 |      66 | Missing structural boundaries, malformed dates or lost reading order |
| Project/client narrative     |      45 |      45 | Assignment dates do not establish employer tenure                    |
| Explicit employer labels     |       4 |       4 | Missing own tenure or mixed assignment context                       |
| Headed tables                |       4 |       4 | Column ownership or original layout remains unresolved               |
| Other narrative/layout       |       2 |       2 | No supported extraction added                                        |
| **Total**                    | **129** | **121** | Heuristic review queues, not adjudicated causes                      |

Sanitized regressions cover every new family plus project/client isolation, reversed dates, missing endpoints, duty-prose boundaries, location exclusion and concurrent-current-role handling. The complete local gate includes 31 source/parser/acceptance-harness regression files, typecheck, scoped formatting, full-subset comparison, original-file comparison and whitespace checks. Verify exact-head CI and commit statuses after the single batch push.

Scope remains **SUBSET_ONLY: 277 / 970**. Production remains **NO_GO** pending live OCR with persisted provenance, reviewed/version-matched backfill, audit of all 970 sources and authenticated acceptance on the exact artifact to promote. No runtime configuration, Supabase/Vercel write, source mutation, backfill or promotion occurred.

## Heading-boundary recovery batch — 2026-09-16

Baseline `3522e2533d731c344f5f62d2ac6fdf7221730b6e`; parser `candidate-employment-v73-heading-boundary-batch`. The complete unresolved inventory was reviewed before editing: 121 source records, comprising 66 heading/date-boundary, 45 project/client-heavy, four explicit-label, four headed-table and two other cases.

This batch recovers employment headings whose field boundaries survive as a role keyword, legal company suffix, comma, pipe, location or bullet even when spaces next to dates disappear. It supports the `Work Experience/s` heading, attached employer/month and title/month tokens, year-first and already-normalized numeric month dates, and explicit trainee role annotations. A following client label terminates an employer row; its contents and dates are never borrowed. Repeated comma-delimited headings are accepted only at sentence boundaries. An employer-only heading keeps its title empty. Training programmes, missing or reversed endpoints, unsupported location boundaries and project-only copies remain excluded.

The complete 277-source comparison gives **156 -> 164 source records with employment**, **586 -> 595 rows**, and **121 -> 113 records without employment**. Eight previously unresolved source records gain nine rows. All 586 existing employer/title/start/end/current tuples are retained. Malformed, duplicate and invalid-range counts remain zero; overlap review remains nine and possible client/employer equality remains one. These counts establish partial source recovery, not complete histories or unique-person totals.

| Remaining review queue       |  Before |   After | Continuing reason                                                         |
| ---------------------------- | ------: | ------: | ------------------------------------------------------------------------- |
| Date near employment heading |      66 |      58 | Missing boundaries, corrupted tokens, partial dates or reading-order loss |
| Project/client narrative     |      45 |      45 | Assignment ranges do not establish employer tenure                        |
| Explicit employer labels     |       4 |       4 | Missing own tenure or mixed assignment context                            |
| Headed tables                |       4 |       4 | Column ownership requires source-layout evidence                          |
| Other narrative/layout       |       2 |       2 | Insufficient supported employment evidence                                |
| **Total**                    | **121** | **113** | Heuristic queues, not adjudicated root causes                             |

All 13 available original-file representations remain unchanged at 57 tuples. No original was substituted into the export and no new CV request is established by this batch. Local validation covers 31 source/parser/acceptance-harness regression files, typecheck, scoped formatting, whitespace checks, full-subset comparison and original-file comparison. Sanitized fixtures include each supported heading and negative project/client, training, malformed-range and location cases. Verify CI and commit statuses on the resulting head before merge.

Production remains **NO_GO**: live OCR with persisted provenance, reviewed/version-matched backfill, all-970-source audit (693 not audited here) and authenticated acceptance of the exact promotion artifact remain outstanding. No runtime configuration, Supabase/Vercel write, backfill or production promotion occurred.

## Owned fields and recruiter-authorized project estimates — 2026-09-16

Baseline `b71d84baf3d65263f9f1752eae68c7132f975bab`; parser `candidate-employment-v74-owned-fields-batch`. Before editing, all 113 unresolved sources were grouped into 58 heading/date-boundary, 45 project/client-heavy, four explicit-label, four headed-table and two other cases. This batch repairs employer summary tables, numbered Duration / Role Played forms, explicit worked-for statements, labelled POSITION/occupation rows, year-only headings, current employer/title statements and undated employer/role headings before Project Involvement. Malay `Mac` is normalized to March, consistent with the existing layout reader. A PDF page footer is stripped from a role field. Negative fixtures retain project/client boundaries, reject malformed dates and avoid filling titles from assignments.

Full 277-source comparison: **164 -> 176 sources with employment**, **595 -> 627 rows**, **113 -> 101 without employment**. Twelve previously unresolved source records gain 32 rows; all 595 previous employer/title/start/end/current tuples are retained. Malformed, duplicate and invalid-range diagnostics stay zero. Overlap review flags stay nine; possible client/employer equality stays one. Of the 627 rows, 554 have titles and 618 have complete source date ranges; these are partial source histories, not complete CVs or unique people.

| Remaining review queue   |  Before |   After | Continuing reason                                                                              |
| ------------------------ | ------: | ------: | ---------------------------------------------------------------------------------------------- |
| Heading/date boundary    |      58 |      48 | Lost layout, incomplete or malformed dates and unsupported boundaries                          |
| Project/client narrative |      45 |      43 | Employer identity or assignment ownership is not sufficiently established                      |
| Explicit employer labels |       4 |       4 | Ambiguous fields or missing assignment ownership                                               |
| Headed tables            |       4 |       4 | Existing originals require reviewed source replacement/backfill; not a request to resend files |
| Other narrative/layout   |       2 |       2 | Insufficient supported employment evidence                                                     |
| **Total**                | **113** | **101** | Heuristic review queues, not adjudicated causes                                                |

### Recruiter-requested estimate policy

The recruiter explicitly authorized estimating missing employer tenure from the first and last project at that employer. This supersedes earlier statements prohibiting _all_ project-based tenure estimates; it does not authorize rewriting source dates as fact. `estimatedTenure` retains its own start/end, project IDs and `project_envelope` basis. Both employment views label it as estimated and warn that gaps may exist. Explicit employer ownership is required. Client matching and title similarity alone are insufficient. Multiple roles at the same employer remain unresolved unless ownership is disambiguated. Complete source tenure takes priority, partial source endpoints constrain eligible projects, invalid/future/reversed project dates are excluded, and a current employer does not extend a finished project to today.

For source-backed Project Involvement headings, the established employer and role own the following assignment range only before another employer or duties. Multiple named projects sharing one range remain one assignment group. This adds **four estimated employer ranges on one source record** without changing its blank source endpoints. No database write occurs.

SAP experience now counts the union of supported SAP delivery intervals from dated roles and assignments. Accounting, sales and SAP end-user roles do not qualify merely because SAP/module skills are present. SAP Sales and Distribution consulting remains eligible. Non-SAP skills do not qualify generic titles. Project-envelope gaps are not SAP experience; overlapping employment/project months count once. Dated evidence takes precedence over a larger declared SAP total. General career years remain separate. In the 277-source comparison, SAP duration changes on 16 records: 13 previously unestablished values gain supported durations and three increase; none decrease or become unknown. This is an evidence-based subset calculation, not a reviewed full-history certification.

All 13 available original-file representations retain the same 57 employment tuples. Original cohorts remain separate from the export; no substitution/backfill occurred. Local verification: 33 regression files, focused negative ownership checks, typecheck, required formatting, whitespace checks and full-subset/original comparisons pass. Verify exact-head CI and statuses after the batch push. Synthetic tests and this checkpoint contain no candidate identities, contacts or private source IDs.

Production remains **NO_GO** pending live OCR/provenance, reviewed version-matched backfill, all-970-source audit (693 still unaudited) and authenticated acceptance of the exact promotion artifact. No runtime configuration, Supabase/Vercel write or production promotion occurred.

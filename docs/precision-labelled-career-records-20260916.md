# Labelled career records — 2026-09-16

## Scope and result

`candidate-employment-v85-labelled-career-records` continues from v84 (`52c0d134a1cb34b548961bfec964e1637d6bea41`). All 301 sources without employment were screened before selecting source-supported layout families. This is a read-only parser projection, not a database backfill or a claim that recovered profiles are complete.

The batch recovers 23 rows across eight previously empty sources and corrects a truncated Project Manager title on one already populated source. Across all 970 sources, 1,904 prior tuples remain exactly unchanged; one incomplete title tuple is replaced by its full source title. No prior employer or date is removed. Original CV/source records remain unchanged.

| Metric | v84 | v85 |
| --- | ---: | ---: |
| Sources with employment | 669 | 677 |
| Employment rows | 1,905 | 1,928 |
| Sources without employment | 301 | 293 |
| Malformed / duplicate / invalid-range | 0 / 0 / 0 | 0 / 0 / 0 |
| Profiles with overlap flags | 55 | 55 |
| Possible client/employer equality flags | 2 | 2 |

## Source families handled together

- Explicit From/To/Description ledgers: each complete date range owns only the following employer and role up to the next range. Detailed project sections terminate the table.
- Duration/Position/Tools cards and Company/Client/Position/Duration snapshots: field labels bound ownership; client names cannot become employers; Project Manager remains part of a title; explicitly separated employer locations are retained separately.
- Former-name employer headings: preserve the named employer and explicit tenure without assigning a later subrole to the whole period.
- Quoted worked-as statements and short-year month ranges: normalize typography and date abbreviations only within the explicit statement. Calendar days remain days.
- Year/Designation tables: Project Manager is a role, not a project section. Ambiguous trailing scope phrases cannot become the next employer.

A full-population trial of global abbreviated-year expansion produced incorrect joins in unrelated tables. That approach was rejected before publication. Expansion is scoped to explicit worked-as statements, and a complete-output regression protects the pre-existing short-year table reader. Narrative phrases beginning with Worked/Working/Employed as/at/with/for cannot become employer names.

## Queue inventory and remaining work

The initial 301-source screening assigned one signature family per source: employment sentences 106, other employment headings 66, other source review 56, project/client-heavy 23, Duration/Position cards 15, former-name annotations 14, non-SAP education review eight, explicit-field layouts five, explicit-employer labels five, labelled career tables three. These are screening signatures, not counts of automatically recoverable records: many sentence matches are responsibilities or project descriptions.

The stable review categories after this batch are:

| Group | Before | Remaining | Specific follow-up |
| --- | ---: | ---: | --- |
| Employment heading/layout | 138 | 131 | Resolve remaining flattened, wrapped and subsidiary-annotated row boundaries against source layouts |
| Other source review | 90 | 90 | Scrambled/insufficient source text requires original-layout evidence, not invented fields |
| Project/client-heavy | 54 | 53 | Establish an explicit employer before using any assignment evidence |
| Non-SAP education/student | 10 | 10 | Confirm actual history; absence of SAP employment can be correct |
| Explicit fields with unsupported layout | 9 | 9 | Resolve detached or incomplete field values without borrowing adjacent dates |
| Total | 301 | 293 | Still unresolved, not declared fixed |

Recovered sources may also retain unresolved rows: scope phrases spanning table cells, unsupported job-role separators and invalid chronology are withheld. A source becoming nonempty is not full semantic acceptance. Private source comparisons and the per-source inventory remain outside the public repository; no identities, source IDs, contact details or raw CV text are published. No additional original file is requested by this batch.

## Verification and release

Twenty-one mandatory source/layout/date/OCR suites, three canonical/Search V2 suites, TypeScript and whitespace checks pass locally. The new synthetic suite asserts complete tuple sets and negative cases, including nested project dates, missing/reversed dates, preserved ordinal days, untruncated titles, and existing short-year table ownership. The mandatory CI workflow includes it.

The full 970-source comparison and independent read-only source audit agree at 677 sources / 1,928 rows. Structural diagnostics do not prove complete semantic accuracy. Exact-head CI verification follows publication; earlier CI results do not validate this revision.

Production remains **NO_GO**. No database, runtime configuration, search-index or deployment mutation was performed in this batch. The previously verified nine-original backfill is still the last documented database write. New output needs source review and reviewed backfill/readback, live OCR with persisted provenance, and authenticated acceptance on the exact artifact proposed for promotion. All 970 stored sources were automatically audited; semantic review is still incomplete. SAP experience policy remains continuous first-to-last qualifying project span within the same explicitly owned employment spell, including internal gaps, with overlaps counted once and non-SAP work excluded; estimates remain distinct from literal dates.

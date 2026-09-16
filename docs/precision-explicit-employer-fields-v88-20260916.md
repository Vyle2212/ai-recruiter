# Explicit employer field families — v88

The post-backfill 970-source review still contained employer-owned fields that were flattened into prose and omitted by v87. This batch adds bounded readers only for repeated layouts with explicit ownership and section boundaries. It is a code-only projection, not a database write or production acceptance.

Complete comparison against exact v87 commit `deab446973ea9820f154c5c9dc7a0498c310be50`, using the same reviewed post-backfill snapshot:

- Nine previously empty sources recover 11 employment rows; one already populated source gains one additional source-owned row.
- All 2,010 v87 employment tuples remain exactly unchanged.
- New projection: 700 sources with employment / 2,022 rows; 270 sources remain without extracted employment.
- Malformed, duplicate and invalid-range counts remain zero. Overlap flags remain 57 and client/employer equality flags remain two.
- Projects remain 156 and project-type gaps remain 15. Missing titles and incomplete date ranges remain visible rather than being filled from assignments.

The supported families are explicit `Client / Company / Duration / Role` cards, current-assignment company records, labelled company-duration rows, employer/role/tenure summaries bounded by project or leaving sections, ISO work-history rows, profile-overview current rows, and distinctive permanent-position or legal-employer headings. `Client`, `Customer` and `Project` prefixes are negative boundaries. A later project role cannot fill a blank employment title.

A broader date/company/Project Manager trial matched role prefixes as employers on an already populated source. The full-population comparison caught the error, and that reader was removed before publication. The final comparison has no removed or replaced tuple.

Remaining review inventory:

| Group                                   | Remaining | Reason                                                                  |
| --------------------------------------- | --------: | ----------------------------------------------------------------------- |
| Employment heading/layout               |       117 | Flattened or wrapped rows still lack safe ownership boundaries          |
| Other source review                     |        90 | Scrambled or insufficient source text requires original-layout evidence |
| Project/client-heavy                    |        47 | No explicit legal employer boundary has been established                |
| Non-SAP education/student               |        10 | No supported SAP employment may be the correct result                   |
| Explicit fields with unsupported layout |         6 | Detached or incomplete labels cannot safely borrow adjacent values      |
| Total                                   |       270 | Unresolved; not declared fixed                                          |

Private comparisons retain candidate evidence outside the repository. This checkpoint contains only aggregate counts and anonymous layout descriptions; it contains no identities, source IDs, contact details or raw CV text.

Mandatory source/layout/date/OCR regressions, three canonical Search V2 suites, the v86/v87 regression suites, TypeScript, formatting and whitespace checks pass locally. Exact-head GitHub CI is required after publication.

No Supabase, search-index, runtime, Vercel or production-data mutation was performed. Production remains **NO_GO** pending semantic review and reviewed backfill/readback where appropriate, live deployed OCR with persisted provenance, and authenticated acceptance on the exact promoted artifact. The previously verified seven-original backfill remains the latest database write.

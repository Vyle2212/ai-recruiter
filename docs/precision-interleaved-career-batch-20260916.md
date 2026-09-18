# Interleaved career columns and dense employment ledgers — 2026-09-16

## Scope and selection

Parser `candidate-employment-v82-interleaved-career-batch` continues from `c4070b15c3d30f9bce79350c8bf2c64f262078e6`. All 347 unresolved sources were screened by existing cause/layout groups before editing. The private snapshot still contains the full 970 stored sources after the previously verified nine-original backfill. Original source text and database records are unchanged.

The batch handles families with explicit field ownership:

- A start date separated from its end by the role or legal employer, including current endpoints. Only a complete local heading can reorder these columns; reversed chronology and missing endpoints remain rejected.
- Date / role / employer / city pipes, explicit role-at-employer headings, role-labelled tenure, and printed-duration headings. Printed durations never manufacture endpoints.
- Date / Company / Position cards with separate job descriptions, joined DateCompany NameRole tables, Organization / Designation / From / To / Comments tables, and dense employment summaries. Day/month spacing and apostrophe-year whitespace are normalized; comments cannot become date cells.
- Compact career headings and role words lost to whitespace removal. Company strings are retained as written, and compact client/project labels are rejected.
- Explicit employer tenure preceding project history remains employer-only where no role is stated. Internship and team-lead qualifiers are retained without creating another job for the same assertion.
- Career summaries and professional-background headings are bounded to source-owned career records. Ambiguous comma-separated rank/company boundaries remain unresolved.

During full-source validation, expanded date normalization exposed a pre-existing boundary gap: an employment section could run into a later `PROJECTS EXPERIENCE` section. Both singular and plural project-section boundaries now terminate employment readers. Five preliminary project-company rows were discarded before publication; they are not counted in this batch. Original employment assertions remain intact.

## Full-population result

| Metric                                     |       v81 |       v82 |
| ------------------------------------------ | --------: | --------: |
| Sources compared                           |       970 |       970 |
| Sources with employment                    |       623 |       650 |
| Employment rows                            |     1,796 |     1,857 |
| Sources without employment                 |       347 |       320 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Overlap review flags                       |        55 |        55 |
| Possible client/employer equality flags    |         2 |         2 |

Twenty-seven previously empty sources recover 61 rows. Every prior company/title/start/end/current tuple is unchanged. These are source-record counts, not unique-person counts, complete histories, or a claim that every new row is SAP work. Existing overlap and equality flags remain review items.

Non-SAP accounting, other ERP and general employment remain career history without automatically increasing SAP years. Unknown titles stay unknown. Recruiter-approved SAP estimates still span the first through last qualifying project at the same explicitly owned employer, including internal time; overlaps count once and known separate employment spells are not bridged. This batch does not change that calculation policy or replace source dates with estimates.

## Remaining queue

| Cause/layout group         | Before | Remaining | Limit                                                                                      |
| -------------------------- | -----: | --------: | ------------------------------------------------------------------------------------------ |
| Employment heading/layout  |    156 |       146 | Mixed columns, ambiguous role/company boundaries, incomplete dates and unsupported layouts |
| Project/client-heavy       |     66 |        61 | Project evidence alone does not establish employer ownership or tenure                     |
| Explicit fields            |     10 |         9 | Incomplete fields or nested labels requiring source review                                 |
| Non-SAP/education-oriented |     11 |        11 | Some sources may legitimately have no employment or SAP experience                         |
| Other source review        |    104 |        93 | Sparse, multilingual, non-CV or heavily damaged text                                       |
| Total                      |    347 |       320 | Review queues, not 320 confirmed parser bugs                                               |

The private queue retains actual source metadata. No profile-specific rule, candidate identifier, real CV excerpt, contact detail or original document is committed. No additional original is requested solely because its extraction remains empty. Existing accessible originals must be checked before any request. Further source review and code recovery may still be possible; this checkpoint does not label all remaining records unrecoverable.

## Validation and release

All 33 local employment/source-layout/date/OCR/search regression files, TypeScript, scoped formatting, new-file formatting and whitespace checks pass. The new interleaved-career suite is mandatory in Production Trust CI. It includes source-family examples and negative project/client, missing/reversed date, malformed label, duration misuse and non-SAP cases. Existing regression expectations were not weakened. Full-population comparison and audit were rerun after the plural project-section fix.

Exact-commit CI and preview results are recorded on PR #6 after publication. They are code/deployment evidence, not authenticated acceptance.

Production remains **NO_GO**. All 970 stored sources have been audited automatically, but source review is not complete. The previously verified nine-original transaction and search-index readback remain the last production data write. This batch is a local projection and is not backfilled. Further reviewed backfill/readback, live Google OCR with saved provenance and authenticated acceptance on the exact deployable artifact remain required. No Supabase/Vercel runtime configuration or production promotion is performed.

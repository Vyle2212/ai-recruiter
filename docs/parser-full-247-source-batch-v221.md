# v221: complete 247-source structural review batch

The queue was regenerated from v220 original-file ingestion, not old structured
candidate data. All 247 queued sources were rerun, and all 892 unique archive
originals were rerun as a regression comparison. This is an automated structural
comparison with targeted original-text checks, not independent factual
adjudication of every field in every CV.

## Shared changes

- Merge source-backed explicit and positioned project readers with nested
  employer projects instead of discarding the other readers when nested
  employment is detected.
- Normalize literal multiline Client, Customer, Project and Duration fields;
  preserve role-label provenance and reject following labels as field values.
- Read bounded role/employer/client/project Word headers without taking the
  next assignment's role or dates. Preserve parenthesized client qualifiers.
- Handle client/duration/role/project headers only when the project closes
  that field header; never move the next project ahead of its own client.
- Read locally dated client cards with explicit project-duration or SAP task
  evidence even when an unrelated Project marker exists elsewhere in the CV.
- Share calendar normalization across both explicit project passes, including
  Malay month aliases. Normalize numeric day/month periods only when a day
  above 12 establishes the ordering and both calendar dates are valid.
- Exclude Responsibilities/Job Scope/Deliverables headings as project names.
  Previous Working Experience and standalone Employer end project evidence.

## Full batch results

| Measure | v220 | v221 |
| --- | ---: | ---: |
| Queued sources checked | 247 | 247 |
| Queued valid project rows | 351 | 454 |
| Queued project coverage review signals | 247 | 237 |
| Entire archive originals checked | 892 | 892 |
| Native extracted sources | 835 | 835 |
| Accepted native sources | 783 | 783 |
| Entire archive valid project rows | 1075 | 1192 |
| Entire archive employment rows | 1876 | 1876 |
| Entire archive project coverage review signals | 247 | 245 |
| Unexpected source exceptions | 0 | 0 |

36 queued sources changed. Ten cleared the project coverage warning; fourteen
recovered more rows but still need review. The remaining 237 queued warnings
must not be classified as source omissions or parser errors without factual
source comparison. Eight sources outside the old queue now need review; the
current full queue therefore contains 245 sources. Keep those sources in scope.

Five sources have fewer project rows. Original-text checks identified earlier
cross-client duplication, a medical-employment role attached to a SAP project,
and heading artefacts. A PDF with interleaved table columns and Title rather
than Role still needs reconstruction; source-specific review of all changed
fields remains necessary. A smaller row count is not proof of improvement.

A bounded literal-header diagnostic found 262 cards, with 250 exact
identity/role/month-range matches. Twelve unmatched diagnostics across six
sources require adjudication: the diagnostic itself can misattribute a later
employment role, so this is not a gold accuracy metric.

57 sources require OCR/layout fallback, which was intentionally not executed
in this offline batch. No database records were written or promoted. The
892 originals have not been mapped one-to-one to the 970 legacy database
profiles. Less-than-1% factual error remains unproven; launch remains NO_GO.

Regression fixtures cover numeric ambiguity and impossible dates, nested plus
explicit projects, role-first headers, local Project Duration, employment-only
client exclusion, project-last card ownership, and heading-only Project fields.
Exact-head CI/build and Acceptance release verification remain separate gates.

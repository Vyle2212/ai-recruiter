# Bounded employer and role cards — 2026-09-23

## Layouts and evidence

On the unchanged private 970-source snapshot, 240 sources had no employment at
the preceding checkpoint. Two recurring layouts showed a role, an employer and
their own complete month range in each card:

- `WORK EXPERIENCE & PROJECT DETAILS` has `role @ employer, country (duration,
  month-year – month-year) Key Roles, Responsibilities & Scope:`. The role and
  employer appear before the card's duty label. A date in a later client or
  project paragraph cannot complete this card. An explicitly printed compact
  `March2019` is normalized to `March 2019`; no missing month is inferred.
- `WORK EXPERIENCE` has bullet-separated `role employer, city, country
  month-year – month-year` cards. The country and bounded role heading separate
  employer from clients mentioned in duty bullets. Repeated punctuation in a
  city delimiter is accepted; a company-less bullet is not.

De-identified positive and negative regressions cover both layouts, client
and project boundaries, invalid or missing dates, and a non-SAP testing role.
A third layout with `Duration:` fields was deferred because its flattened duty
sentence could become part of the employer name. Those sources remain in the
review queue rather than receiving a speculative employment row.

## Read-only full-source comparison

The same 970 records increase from **730 sources / 2,129 employment rows** to
**732 sources / 2,148 rows**. Two previously unresolved sources gain 13 and six
rows respectively. All **2,129** earlier employer/title/start/end/current
tuples are unchanged. Projects and labelled project-tenure estimates are
unchanged on all 970 sources. A non-SAP testing role remains general
employment and does not add SAP delivery years.

Malformed narrative, duplicate and invalid-range diagnostics remain zero;
possible client/employer equality stays at two. Source-dated overlapping roles
increase the overlap review flag from 57 to 58; the dates remain as written
and require source review. All 34 local regression files, TypeScript typecheck,
and the full-source read-only comparison pass.

The **238 remaining sources** have these heuristic review queues, which are
triage counts rather than a determination that each source has employment:

| Review queue | Count | Reason |
| --- | ---: | --- |
| Project/client-heavy | 175 | Assignment dates do not establish employer ownership |
| Career heading/date | 43 | Employer, role or date boundary is unresolved |
| Other narrative/layout | 14 | No supported repeating employer-role boundary |
| Short or missing source | 4 | Insufficient source text |
| Explicit employer field | 1 | Field ownership needs review |
| Headed table | 1 | Column ownership needs review |

No candidate identity, contact detail, original filename, CV excerpt or
private source identifier is included. This comparison did not write a
database. Production remains **NO_GO** pending reviewed adjudication of the
remaining sources, version-matched backfill/readback, live OCR with persisted
provenance, and authenticated acceptance on the exact promoted artifact.

# Production employment projection audit — 2026-09-24

## Version-matched read-only comparison

The current parser was run against all 970 production source records in a
read-only stream. Candidate identifiers, contact fields, filenames, source
excerpts and CV text were not serialized into the report or repository. The
audit made zero database writes.

| State                                | Sources |
| ------------------------------------ | ------: |
| Stored production employment         |     231 |
| Current parser employment projection |     737 |
| Current parser still unresolved      |     233 |
| Stored rows                          |     715 |
| Projected rows                       |   2,160 |

The projection contains zero malformed narrative rows, duplicate rows,
invalid date ranges or detected client-as-employer conflicts. This validates
the aggregate shape; it does not replace source review.

## Promotion safety queues

The audit compares normalized employer, title, date and current-status tuples
before any backfill:

| Mutually exclusive queue                                      | Sources |
| ------------------------------------------------------------- | ------: |
| Empty production history becomes populated; review additions  |     506 |
| Existing history is preserved and additions are proposed      |      27 |
| Existing history is unchanged                                 |     100 |
| Existing history conflicts with the projection; manual review |     108 |
| Empty production history remains unresolved                   |     229 |
| **Total**                                                     | **970** |

Across the 715 stored rows, 492 normalized tuples are reproduced exactly and
223 are absent or changed in the new projection. The projection also proposes
1,668 new normalized tuples. Therefore a full-array replacement backfill is
unsafe: it could erase or rewrite 223 stored tuples across the conflict queue.

## Enforced decision

`lib/productionEmploymentProjectionAudit.ts` and its regression create a
repeatable, privacy-safe aggregate gate. A backfill must keep the five queues
separate. The 108 conflicts cannot enter an automatic replace operation. The
506 empty-to-populated and 27 additive sources still require reviewed source
evidence before an additive write, followed by exact readback; the audit does
not approve those records by itself.

The remaining 233 parser gaps are grouped as 125 project/client-heavy, 90 near
heading/date boundaries, 12 other narrative/layout, four short or missing
sources, one headed table and one explicit-employer-label case.

Production remains **NO_GO**. No Supabase/Vercel configuration, RLS policy,
candidate record or search index was changed. Reviewed additive backfill and
readback, adjudication of conflicts, live OCR, authenticated exact-artifact
acceptance, verified backup and controlled RLS cutover/readback remain required.

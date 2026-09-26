# Archived 970-source review recovery — 2026-09-24

The previously inaccessible private archive was recovered through an authenticated alternate transfer. Its 970 candidate rows were processed read-only outside this repository. The archived `snapshot-after` was captured **2026-09-16 08:40 UTC**; it precedes the more recent production inventory and cannot authorize a production promotion. Nine source texts and parsed payloads changed between the archive's own before/after snapshots. No candidate IDs, CV content, contact details, original filenames, or source excerpts are included here.

| Archived state                                 | Sources | Employment rows |
| ---------------------------------------------- | ------: | --------------: |
| Stored history                                 |     221 |             636 |
| Current parser applied to archived source rows |     727 |           2,081 |
| Parser still empty on archived rows            |     243 |               — |

All **970/970 archived rows** have source text. The 243 remaining parser gaps are grouped by the existing conservative triage classifier: **125** project/client heavy, **98** career heading/date boundary, **12** other narrative/layout, **4** short or missing, **3** headed table, and **1** explicit employer label. These are triage signals, not proof that the missing employment can be recovered safely without reading the underlying source.

The private review pack from this archived snapshot covers **641 sources**: **510** empty-to-populated, **23** additive to existing history, and **108** conflicts. It also accounts for **90** unchanged and **239** still-empty sources. The pack is retained privately outside GitHub, bound to its exact archived snapshot, current code commit, and fingerprint. It has pending review decisions and grants no backup or write authorization. The aggregate comparison still identifies **223** stored employment tuples at risk if conflicts were replaced.

The latest separately measured production projection remains **737/970 sources and 2,160 employment rows**, with **233** unresolved, and the stored production inventory remains **231 sources / 715 rows**. These newer figures must not be overwritten by results from the September 16 archive. A new production snapshot and its version-matched readback are required before reviewers can approve the 533 additions or adjudicate the 108 conflicts for production.

No Supabase/Vercel runtime configuration or production data was changed. Production remains **NO_GO** pending current private review, verified backup, RLS cutover/readback, reviewed backfill and search rebuild/readback, live OCR, and authenticated acceptance on the promoted artifact.

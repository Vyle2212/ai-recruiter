# Private review file boundary — 2026-09-24

The review-pack CLI consumed a private candidate snapshot or reviewed pack
outside the repository without checking its file permissions. Later backup,
authorization and promotion steps already refused inputs readable by other
users. The review step now applies the same owner-only requirement before it
parses either input or writes an output. Synthetic CLI regressions exercise
both `prepare` and `finalize` with a readable-by-others input and require
fail-closed behavior with no output artifact. No actual candidate payload or
identifier is in this checkpoint.

The last available projection remains **737 / 970** sources with employment,
**2,160** employment rows and **233** without extracted employment. The
stored-data inventory remains **231 / 970** sources, **715** rows and **739**
sources without stored employment. The latter group was classified as **416**
heading/date boundary, **227** project/client-heavy, **57** employer label,
**26** table layout, **9** other narrative/layout and **4** missing source.
These totals and groups did not change in this security fix. The full current
private 970-source snapshot was unavailable for a new parser comparison; the
archive transfer returned 502. There is no new source-derived parser claim.

**NO_GO:** 533 additive cases still require private review and backfill;
108 conflicting cases require adjudication without replacing stored history.
A verified backup, RLS cutover and readback, reviewed exact-set search-index
rebuild/readback, live OCR and authenticated acceptance on the promoted artifact
are still required. No production database or deployment was changed.

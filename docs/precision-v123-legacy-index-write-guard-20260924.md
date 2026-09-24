# Legacy search-index write guard — 2026-09-24

## Observed risk and code batch

Five old entry points could write `candidate_search_index` outside the reviewed
promotion transaction: two admin rebuild routes, two legacy index routes and
the standalone rebuild command. The old full rebuild used a different index
builder from current search eligibility, deleted rows in pages while paging
over the same table, and upserted in batches without a matching source-version
readback. The single-candidate admin endpoint also allowed a GET to invoke a
write. The data-repair route attempted to call that rebuild and ignored a
failed response after mutating source records.

The legacy index routes and CLI now refuse writes before opening a database
connection; the GET single-candidate endpoint returns 405. Both exported
legacy rebuild functions refuse invocation. The remaining audit now reads only
status and index metrics and returns aggregate counts. Data repair remains available as
an explicit read-only dry run and refuses mutation until there is a reviewed
transaction with index readback. The aggregate index audit remains read-only
and is now covered by recruiter authorization policy. Direct index routes
remain mapped in the policy registry. A synthetic regression exercises every
blocked handler and the CLI without production credentials.

## Data checkpoint and remaining work

This code-only safety change leaves the last available projection at
**737 / 970** sources with employment, **2,160** rows and **233** sources
without extracted employment. The stored-data inventory remains **231 / 970**
sources, **715** rows and **739** without stored employment. The 739 stored gaps
were classified as **416** heading/date boundary, **227** project/client-heavy,
**57** labelled employer, **26** table, **9** narrative/other and **4** missing
source. None of these counts or group assignments changed in this batch. The
full private 970-source archive still returns HTTP 502 on transfer, preventing
a fresh source comparison. No candidate identifiers or CV text are published.

The guarded routes should remain disabled until an approved exact-set index
transaction verifies a snapshot and backup, source versions and canonical
eligibility, and reads back the exact affected set. **Production is NO_GO:**
533 additive sources need private review; 108 conflicts need adjudication.
Verified backup, RLS cutover/readback, reviewed backfill and index rebuild,
real OCR and authenticated acceptance on the promoted artifact remain open.
No database, Vercel runtime or production data was changed.

# Original CV preservation checkpoint — 2026-09-24

## Measured cause and scope

The authenticated read-only inventory contains 970 candidate sources. The
current parser produces employment on 737 sources (2,160 rows), leaving 233
unresolved. These are split into 125 project/client-heavy, 90 heading/date,
12 other layout, four short or missing, one headed table and one employer
field. All 233 saved text representations contain at most two newline-delimited
lines. Their `source_file` fields are empty. The inspected project has zero
Storage objects. An aggregate-only inspection found six legacy backup rows,
whose `raw_cv` fields also lack layout-bearing line breaks. This does not prove
original files do not exist elsewhere; it does prove the inspected project
cannot currently restore those 233 originals from its Storage inventory.

## GitHub-only repair for future uploads

The CV upload endpoint now archives the original accepted PDF, DOCX or TXT to
an opaque random object key in a private Storage bucket **before** saving the
parsed candidate. The server persists the private bucket/key reference in the
candidate's existing `source_file` field and verifies its readback. An archive
failure prevents the candidate write. An explicitly rejected save removes its
unlinked private object. An ambiguous database failure deliberately retains the
private object: the database may already have committed its reference. No original bytes, filenames, contact
fields or candidate IDs are placed in this repository. The prepared bucket SQL
is `supabase/manual/202609240003_private_original_cv_archive.sql`; readback
is `supabase/manual/202609240004_private_original_cv_archive_readback.sql`.
Neither has been executed in production. The private bucket must be created
and its permissions verified before the new upload route is deployed.

This prevents another silent loss of original upload bytes; it does **not**
recover the 233 older originals or approve any of the 533 proposed additive
reviews or 108 conflicts. These queues remain blocked pending source review.

## Local verification and release decision

The archive contract, source-preservation regression, projection audit and
typecheck pass. A read-only replay of all 970 sources remains **737 sources /
2,160 rows; 233 unresolved**; client-as-employer conflict and invalid-range
diagnostics remain zero. No Supabase data, Storage object, bucket, policy or
Vercel configuration was changed. The private review pack and original source
text remain outside the public repository.

Production stays **NO_GO**. The reviewed backup/backfill/readback, 108 conflict
decisions, 25-table RLS cutover/readback, live OCR, authenticated deployed-SHA
acceptance and exact-artifact search checks remain release gates.

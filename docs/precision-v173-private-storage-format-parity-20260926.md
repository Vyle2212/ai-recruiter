# Precision v173: private Storage format parity

## Measured source impact

The private source inventory contains 905 supplied originals and 892 distinct
byte contents. Its Word subset includes 170 legacy DOC files and one RTF file
(167 and one distinct contents respectively). The shared admin and candidate
upload paths already validate these formats, but the prepared production
Storage bucket allowed only PDF, DOCX and TXT. A supervised cutover using that
SQL would therefore reject all 171 supplied DOC/RTF originals before the shared
parser or review queue could run.

The private bucket definition and its read-only verification now include the
same five MIME types accepted by the archive-key contract: PDF, DOCX, DOC, RTF
and TXT. The regression test derives its Storage assertions from the same
supported-format cases, so adding an application format without updating both
SQL artifacts fails locally and in CI. No candidate-specific rule, filename,
contact detail, source excerpt or per-file hash is stored in this checkpoint.

## Read-only runtime evidence

A current read-only catalog check found 25 production tables in `public`: two
have RLS enabled and 23 do not. The production project has no Storage bucket.
The security advisor also reports the 23 RLS-disabled tables, two owner-privileged
audit views and six functions without a fixed search path. The staging catalog
has eight `public` tables and all eight have RLS enabled. These observations are
pre-cutover evidence only; no database, Auth, Storage or deployment setting was
changed.

## Remaining release gates

Production remains **NO_GO**. The prepared SQL must not run until a fresh,
version-matched backup has been restored and verified in isolation. A supervised
cutover still needs exact-artifact RLS/view/RPC readback, private Storage
creation/readback, Auth verification, live OCR upload/readback, and the complete
970-or-more unique-original audit. The available collection remains at 892
distinct originals, at least 78 below that gate. The unresolved parser queues
remain 169 employment sources (94 project/client-heavy, 56 near-heading, 10
explicit-employer, seven table and two other) plus 44 PDF layout cases and 15
OCR-required PDFs; no parser rule was changed without bounded source-owned
evidence.

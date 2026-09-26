# Precision v174: scope the original CV gate to the available collection

Vy authorized working from the CV originals currently available instead of
waiting for a declared 970-original target. Two independent filesystem copies
were compared by content: 905 files, 892 distinct contents, with matching
collection fingerprints. No filename, candidate identity, contact or file
content is recorded here.

The offline parser audit and recovery manifest now default to a minimum of 892
distinct originals. The production cutover planner accepts a verified
905-file/892-distinct collection while still requiring a fresh, isolated and
matching database restore of the existing production candidates. The 970
candidate database count remains a separate restore check. An incomplete,
substituted or nonindependent original collection still fails closed.

The private production Storage bucket `candidate-original-cvs` was created and
read back as private with a 10 MiB limit and PDF, DOCX, DOC, RTF and TXT
allowed. It currently has zero objects. This was a Storage configuration
change, not a CV upload or candidate data backfill.

The prepared production Auth foundation was also installed. Its three new
`public` tables have forced RLS, no anonymous table read grants, and only the
user's own `user_profiles` row is readable by an authenticated user. A live
catalog readback confirmed these grants and the single self-read policy.
There are still zero production Auth users, so owner bootstrap and a real
signed-in acceptance run have not happened.
The cutover planner now treats the installed foundation and bucket as
preexisting production configuration. It retains their readbacks and does
not try to replay the one-shot foundation migration.

The complete available offline audit is bound to the exact collection. Its
review and OCR outcomes must remain visible in the release decision; lowering
the collection minimum does not mean that every parsed profile is accurate.
On the latest fetched parser head (`7d68318`), it reports zero source failures,
1,859 valid employment rows and 559 valid project rows. Four CVs meet the
complete-for-validation criteria, 779 need review, 46 need classification
review, four fail resume quality, 44 PDFs need layout review and 15 require
OCR. The same-population comparison against the preceding local parser head
adds one valid project row without changing employment gaps or source failures.
Legacy-data RLS, isolated database restore, initial owner bootstrap,
authenticated upload/OCR readback and reviewed promotion still require
separate evidence.

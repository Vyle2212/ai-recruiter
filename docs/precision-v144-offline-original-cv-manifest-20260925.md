# Offline original-CV collection verification

The production cutover planner now measures the CV collection rather than
accepting self-reported counts or hashes. The operator must provide two separate
offline copies of the same complete collection using `--source-cv-directory`
and `--verified-cv-directory`. Both directories must be outside the repository;
symlinks and hard links between copies are refused. No file is uploaded by this
check.

Only PDF, DOCX and TXT files up to 10 MB are counted. Unexpected entries and
unreadable files fail closed. SHA-256 is calculated for every file, and the
sorted multiset of hashes is compared between copies. Both the total file
count and the number of distinct byte contents must agree; there must be at
least 970 distinct files. The planner adds the measured fields to the private
recovery evidence automatically; if those fields were provided earlier, they
must match the measurement exactly. Operational errors use
fixed codes, and no CV filenames, contents, per-file hashes or candidate IDs
are serialized to the plan or CI logs.

This establishes byte-level preservation and a minimum number of distinct
documents. It does **not** prove one-to-one correspondence with the 970
candidate rows, SAP classification, extraction completeness, or a successful
database restore. Those still need supervised readback and live synthetic
upload/OCR checks before bulk upload can open. The two offline copies are not
available to this CI run, so production remains `NO_GO`; no production data,
Storage objects, policies, or configuration were changed.

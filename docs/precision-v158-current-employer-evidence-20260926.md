# Current-employer evidence gate in shared CV ingestion

The shared admin and candidate upload pipeline now treats `current_company` as
a temporal fact, not a reusable text field. It may be populated only from a
canonical employment row whose source dates explicitly mark the row as current.
Completed employment, an undated company label, a stale parser field, or a
pre-existing upstream `current_company` cannot override that evidence gate.

This closes a gap left after v156. Its split-date reader correctly marked closed
rows as historical, but upload enrichment could still fall back to a company
value produced by an earlier parser layer. That fallback is removed
system-wide. The rule applies identically to `admin_upload` and
`candidate_upload`.

Deterministic regression coverage includes:

- open-ended split-date employment still supplies the current employer;
- completed split-date employment remains in history but has no current employer;
- a deliberately stale upstream current-company value cannot re-promote that
  completed employer; and
- admin and candidate uploads continue to produce equivalent parser output.

This batch changes no private parser totals. The latest retained aggregate
evidence remains 357 unique Word sources, 819 valid employment rows, 101 sources
without valid employment and 355 projects. The broader archive remains 905
originals / 892 unique contents, at least 78 short of the 970-unique-file target.
No filename, identifier, contact field, CV excerpt or per-file digest is stored
in this checkpoint.

Production remains `NO_GO`. This code-only correction does not replace a
current isolated restore, private Storage/RLS/Auth cutover, authenticated
production-provider upload/OCR, exact readback or reviewed field-level
acceptance. No production database row, Storage object or runtime configuration
was changed.

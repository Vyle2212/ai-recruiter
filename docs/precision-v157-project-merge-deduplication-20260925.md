# Project merge deduplication in the shared CV parser

Admin and candidate uploads continue to use the same `prepareCandidateCv`
pipeline. This batch fixes a merge error between the canonical project reader
and the explicit labelled-card reader. Previously, one reader could retain a
clean role while another captured the same role plus its date range and duties.
The same source-owned project then appeared twice and could inflate project
counts or expose a polluted role to matching.

Two rows are now merged only when client or project ownership, role prefix and
the ordered date range agree. A longer role is treated as polluted only when
its extra tail contains date or delivery/responsibility evidence. The clean
explicit role wins, while source-backed project type and modules are retained.
Different clients, project names, roles or periods remain separate assertions.

Deterministic end-to-end regressions run the same source through both
`admin_upload` and `candidate_upload`. They verify one clean project output for
the duplicate-reader case and preserve two rows for genuinely different roles
on the same client and period. Existing contradictory-client, adjacent-card,
reversed-date and project-boundary regressions remain in place.

This batch makes no whole-archive recovery claim and writes no candidate data.
Production remains `NO_GO` pending current isolated restore evidence, private
Storage/RLS/Auth cutover, authenticated synthetic upload/OCR, exact readback,
and reviewed field-level accuracy before any bulk upload or replacement.

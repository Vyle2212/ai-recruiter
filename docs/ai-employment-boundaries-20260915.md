# AI employment boundary hardening

The initial evidence gate could accept field prefixes (Example vs Example Systems; SAP vs SAP Consultant), trust an excerpt cropped out of a project section, and forward arbitrary unvalidated properties through object spread.

Require exact employer/title field boundaries for supported labelled rows, check the preceding source section at excerpt occurrences, and emit only checked company/title/start/end/current/evidence fields. Raw proposals remain available for review. Unlabelled or unsupported layouts require review; this is not a completeness guarantee.

Regression tests cover abbreviated fields, project-context excerpts, a valid later employment occurrence, and removal of invented module/responsibility/confidence properties. Evidence tests, AI engine/source-integrity tests and typecheck passed. Deterministic source-audit counts are unchanged. No database write or production promotion occurred; end-to-end integration and authenticated runtime acceptance remain outstanding.

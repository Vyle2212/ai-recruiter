# Flattened project labels in the shared CV parser

This batch fixes project cards whose PDF or document extraction collapses all
labels onto one line. Both admin and candidate uploads now keep clean project
names, clients, and roles when labels are separated by pipes or semicolons.
The shared reader also treats `End Client` and `End Customer` as explicit
project ownership labels rather than leaking the word `End` into the project
name.

The cleanup runs before enterprise-project deduplication, so search, matching,
candidate views, and later persistence consume the same canonical field values.
It removes only boundary pipe and semicolon delimiters; it does not infer
missing clients, roles, dates, SAP evidence, or delivery evidence.

Deterministic tests cover pipe- and semicolon-flattened cards, `End Client`,
canonical project normalization, and parity between `admin_upload` and
`candidate_upload`. Existing section-boundary, incomplete-card, date-order,
duplicate-project, and contradictory-client regressions remain active.

This change makes no whole-archive recovery claim and writes no candidate data.
The broader private evidence remains 905 original files / 892 unique contents,
at least 78 unique sources short of the 970-file release target. No filenames,
identifiers, excerpts, contact fields, or source digests are committed.

Production remains `NO_GO` for bulk upload or profile replacement until a
current isolated restore and original-file recovery are verified, production
RLS/Auth/private Storage are complete, and an authenticated synthetic
upload/OCR/readback succeeds with the production provider.

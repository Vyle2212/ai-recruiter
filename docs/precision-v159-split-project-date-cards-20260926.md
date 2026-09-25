# Split project-date cards in the shared CV parser

This batch extends the single SAP CV parser used by both admin and candidate
uploads. A project card can now supply its period through `Start Date` / `End
Date`, `From` / `To`, or `Date From` / `Date To`, with either same-line or
next-line values.

The rule remains evidence-bound. A project still requires its own named project
or client, role, start date, and end date. Extraction stops at the next project
or client card and at the next non-project section. Two adjacent incomplete
cards cannot lend dates to each other, later education or skills content cannot
complete a project, and reversed or unparseable dates remain unstructured for
review.

Deterministic parity tests cover all three label families for `admin_upload`
and `candidate_upload`, adjacent partial cards, cross-section dates, and
reversed dates. Existing labelled, multiline, mixed project-card, duplicate,
and contradictory-client regressions remain in the same test suite.

This change makes no whole-archive recovery claim and does not write candidate
data. The broader private evidence remains 905 original files / 892 unique
contents, which is still at least 78 unique sources short of the 970-file
release target. No filenames, identifiers, excerpts, contact fields, or source
digests are committed.

Production remains `NO_GO` for bulk upload or profile replacement until a
current isolated restore and original-file recovery are verified, production
RLS/Auth/private Storage are complete, and an authenticated synthetic
upload/OCR/readback succeeds with the production provider.

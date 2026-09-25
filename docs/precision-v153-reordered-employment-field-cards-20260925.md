# Reordered employment field cards in the shared CV parser

Admin and candidate uploads continue to use the same `prepareCandidateCv`
pipeline. This batch extends the bounded employment-card reader for source
layouts that print the date before the employer, split the period into
`Date From` / `Date To`, use `Company Name` or `Company Served` as explicit
ownership, or use `Job Title` / `Title` for the role.

Every accepted row still requires one employer, one role and an ordered date
range inside the same employment-owned card. Employer and role labels must
occur before any client/project fields. This prevents a client assignment from
supplying a missing employment role or period. Missing roles, missing dates,
reversed dates, client-only cards and values from adjacent cards remain review
items; no date or employer is inferred.

## Same-population private Word result

The read-only comparison used the same 363 Word files and 357 unique byte
contents as the v152 baseline. It emitted only aggregate counts.

| Aggregate                                      | v152 baseline | This parser | Delta |
| ---------------------------------------------- | ------------: | ----------: | ----: |
| Valid employment rows                          |           815 |         819 |    +4 |
| Sources missing valid employment               |           103 |         101 |    -2 |
| Valid project rows                             |           355 |         355 |     0 |
| Complete for validation                        |             1 |           1 |     0 |
| Explicit-employer-label review queue           |            11 |           9 |    -2 |
| Headed-table review queue                      |             7 |           7 |     0 |
| Near-heading/date review queue                 |            43 |          43 |     0 |
| Project/client-heavy employment-evidence queue |            39 |          39 |     0 |
| Other employment layout review queue           |             1 |           1 |     0 |

The net row increase consists of five newly recovered source-owned rows and
one prior row removed because its role and duration were located after a client
project boundary. The remaining sources in this group do not establish a
separate role and ordered dates for each employer, or describe only
client/project assignments, so they remain unresolved.

The audit serialized zero filenames, candidate identifiers, excerpts, contact
fields or per-file digests and made zero database writes. The Word subset is
not a complete 970-source acceptance run and does not prove field-level
accuracy.

Production remains `NO_GO`. The private archive still contains only 892 unique
originals, at least 78 short of the 970-unique-file target. Fourteen PDFs still
require OCR and 60 retain unresolved employment layout. Current isolated
restore evidence, private Storage/RLS/Auth cutover, authenticated synthetic
upload/OCR and exact readback are also still required before replacing or
bulk-uploading production profiles.

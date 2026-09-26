# SAP Sales and Distribution consulting qualification — 2026-09-23

## Grouped source review

The same private 970-source snapshot was screened before this change. Of the
265 sources without employment extraction, the mutually exclusive heuristic
queues remain 182 project/client-heavy, 60 near a heading and date, 14 other
narrative/layout, four explicit employer labels, four short/insufficient, and
one headed table. These queues do not prove that every source has SAP work.
The near-heading examples mix actual jobs, projects, non-SAP roles, and
education. Their shared heading/date signals do not justify an automatic
employer or date assignment.

A separate review of the 2,053 extracted employment rows found one supported
`SAP Sales Distribution Consultant` role incorrectly excluded from SAP
experience because the sales filter required a conjunction before
`Distribution`. The generalized qualifier now accepts SAP Sales Distribution
consulting with or without that conjunction, while excluding ordinary sales,
SAP product sales, and end-user roles. De-identified positive and negative
tests cover all of these boundaries. The experience projection version was
advanced so a cached SAP duration cannot retain the prior classification.

## Full-population comparison

Read-only re-projection of all 970 sources on the identical input changes SAP
experience in exactly one source, from 11.7 to 12.7 years. Its original
year-only employment dates retain their source precision; the 1.0-year change
is a calculation, not an edited date or a claim of month precision. Every
employment tuple and project count across all 970 sources is unchanged:
705 sources with employment, 2,053 employment rows and 265 without extraction.
No project client was promoted to an employer.

This code-only change does not write to the candidate database. OCR of
original files, reviewed/version-matched backfill/readback, source review and
authenticated acceptance on the exact promoted artifact remain release
gates. Production remains **NO_GO**. This checkpoint contains no CV, raw
source text, candidate identity, contact detail or original filename.

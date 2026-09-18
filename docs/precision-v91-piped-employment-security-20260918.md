# Piped employment ownership and candidate API security — 2026-09-18

## Recovery scope

Parser version `candidate-employment-v91-piped-role-employer-period` adds a
bounded reader for explicit `title | employer | period` rows inside employment
sections. Client, customer, project, responsibility and duty text remains
ineligible as an employer.

The first full re-projection of the reviewed 970-source snapshot reached 706
sources with employment and 2,065 employment rows, leaving 264 sources without
employment. This is a local projection, not a production write or complete
semantic acceptance.

Full regression exposed a cross-row ownership defect in that first projection:
a date-first row could be re-read as a role-first row and borrow the following
role's period. The repair rejects a title containing a date range and prevents
an unowned preceding date range from becoming the next piped row's tenure.
Explicit overlapping date-first roles retain their original, separate periods.

The 706 / 2,065 projection must be regenerated before it is used as post-repair
accuracy evidence. It is retained here as the pre-repair checkpoint only.

## Candidate API security

Candidate detail, search, legacy candidate-data and validation endpoints now
require the established recruiter authorization path. Candidate validation
uses the lazy server-side service client, and private responses carry no-store
headers. The staging RLS fixture and authorization regressions cover these
routes. No runtime policy, credential or database setting was changed by this
GitHub-only batch.

## Verification and release status

The delimited, bounded, flattened, explicit-employer, original-layout and
three-tier recovery suites pass locally after the ownership repair. TypeScript
typechecking and whitespace checks pass. Exact-head Production Trust and
immutable-action CI remain required after the commit is published.

Production remains **NO_GO**. A green build or preview does not replace a
regenerated full-source comparison, reviewed backfill/readback, deployed OCR,
or authenticated acceptance on the exact artifact to promote. No private CV,
candidate identifier, contact detail or database evidence is committed.

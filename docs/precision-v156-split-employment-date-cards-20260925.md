# Split employment date cards in the shared CV parser

Admin and candidate uploads continue to use the same `prepareCandidateCv`
pipeline. This batch adds one bounded rule for employment cards that express a
period as separate fields instead of one date range. The accepted field pairs
are `From` / `To`, `Start Date` / `End Date`, and `Date From` / `Date To`.
`Job Title` and `Title` are accepted as explicit role labels in the same card.

Every recovered row still requires an employment-owned section or an explicit
Employer/Organization owner, one employer, one role, and an ordered date pair.
Both date fields and the role must occur before any client/project boundary.
An incomplete card cannot borrow an end date from the next employer. Reversed
dates, project-owned cards, historical-only jobs, and split fields crossing a
client boundary remain review items.

The shared upload payload now also derives `current_company` from a canonical
employment row only when that row is explicitly open-ended. A closed historical
row is retained in employment history but is not promoted to current employer.
This keeps completeness checks aligned with the same source evidence used by
search lifecycle gates.

Deterministic regressions cover all three label families through the canonical
employment reader and both admin and candidate upload sources. They also cover
project isolation, client boundaries, adjacent incomplete cards, reversed
dates, and historical-only rows. This batch makes no whole-archive recovery
claim; the private source population was not modified and no candidate data was
written.

Production remains `NO_GO`. Bulk upload or replacement still requires current
isolated restore evidence, private Storage/RLS/Auth cutover, authenticated
synthetic upload/OCR, exact readback, and reviewed field-level accuracy. No
production profile or Storage object is changed by this batch.

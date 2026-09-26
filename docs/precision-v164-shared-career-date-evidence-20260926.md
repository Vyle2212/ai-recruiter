# Precision v164: shared career date evidence

## Systemic defect

The labelled employment-card readers still used an older date grammar than
the canonical career validator. A complete card with an explicit employer,
role and range could therefore disappear when it used an apostrophe
two-digit year, an ISO year-month value, `Now` or `To date`. Admin and
candidate upload both called the same pipeline and both lost the same grounded
employment evidence.

## Shared rule

- Project and employment readers now import one deterministic career-date
  grammar instead of maintaining incompatible regular expressions.
- Supported evidence includes named months with two- or four-digit years,
  `MM/YYYY`, `YYYY-MM`, year-only dates and explicit current markers.
- `Present`, `Current`, `Now`, `Till date`, `Till to date` and `To date` mark
  an employment as current only when printed as its endpoint.
- Every accepted range still passes calendar, future-date and chronological
  validation through `careerMonthIndex`.
- A labelled employment card must own its employer, role, start and end. Two
  adjacent partial cards cannot lend endpoints to one another.

## Verification

Synthetic full-pipeline tests exercise both admin and candidate upload with
duration labels and split start/end labels. The tests require identical
employment history, current-employer and completeness results for both
sources, and separately verify that adjacent partial records remain blocked.
Existing project, employment, search lifecycle and completeness regressions
remain required by Production Trust CI.

No production row, Storage object, authentication policy or profile was
changed. This checkpoint contains no candidate identifier, filename, contact
field, CV excerpt or per-file digest. Bulk upload remains blocked until a fresh
isolated restore, private Storage/RLS/Auth review and authenticated synthetic
upload/OCR/readback succeed against the production provider.

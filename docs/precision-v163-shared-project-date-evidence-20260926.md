# Precision v163: shared project date evidence

## Systemic defect

The canonical project reader accepted numeric year-first dates, apostrophe
two-digit years and `Now`, but the explicit labelled-card reader still used an
older date grammar. A CV containing only `Project`, `Client`, `Role` and
`Duration` could therefore lose a complete assignment unless nearby prose also
contained delivery keywords. Admin and candidate upload called the same
pipeline, so both sources failed consistently rather than safely.

## Shared rule

- All deterministic project-card readers now import one project date grammar.
- Supported evidence includes named months with two- or four-digit years,
  `MM/YYYY`, `YYYY-MM`, year-only dates and explicit current markers.
- `Present`, `Current`, `Now`, `Till date` and `To date` resolve to the current
  month only when printed as the endpoint.
- Calendar validation, future-date rejection and reversed-range rejection still
  run through `careerMonthIndex`; no missing endpoint is inferred.
- A sparse labelled card still requires its own project/client identity, role
  and complete date range. It cannot borrow evidence from the next card or
  another section.

## Verification

Synthetic parity coverage exercises both admin and candidate upload with
apostrophe years, ISO year-month values and `Now`, without using scope prose to
rescue the record. Career-date tests also verify every supported current
marker. Existing project, employment, completeness and search lifecycle
regressions remain required by Production Trust CI.

No production row, Storage object, authentication policy or profile was
changed. This checkpoint contains no candidate identifier, filename, contact
field, CV excerpt or per-file digest. Bulk upload remains blocked until a fresh
isolated restore, private Storage/RLS/Auth review and authenticated synthetic
upload/OCR/readback succeed against the production provider.

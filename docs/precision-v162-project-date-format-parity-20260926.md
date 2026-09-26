# Precision v162: project date-format parity

## System-wide correction

Employment validation already understood named months, numeric month/year,
year-first month values, two-digit named years and year-only dates. The shared
project-card reader previously accepted only part of that set. As a result, a
single CV could have a valid employment timeline while the matching project
lost its client or disappeared.

Project cards now use one bounded date rule for:

- named months with four- or two-digit years;
- `MM/YYYY` and `YYYY-MM` values;
- year-only periods;
- `Present`, `Current`, `Now`, `Till date` and `To date`; and
- dash, en dash, em dash, `to` and tilde separators.

All parsed endpoints still pass the canonical calendar validator. Missing,
future or reversed periods remain unstructured for review. Current markers are
handled consistently when canonical and explicit project readers merge, so
the same active assignment cannot appear twice merely because one reader used
`To date` or `Till date`.

## Verification

The matrix runs every supported date family through both `admin_upload` and
`candidate_upload`, requiring the same project name, client, role and exact
source endpoints. Project ownership, candidate-profile ingestion, TypeScript
and the production build remain mandatory checks.

No candidate identifiers, filenames, contact fields, CV excerpts or per-file
hashes are included. No production database row, Storage object, Auth setting
or runtime configuration changed.

## Release status

This batch is format-parity evidence, not proof of whole-archive accuracy. The
broader private evidence remains 905 originals / 892 unique contents, at least
78 short of the 970-unique-file target. Production remains `NO_GO` until a
current isolated restore and original-file recovery are verified,
RLS/Auth/private Storage are completed, and authenticated synthetic
upload/OCR plus exact readback pass.

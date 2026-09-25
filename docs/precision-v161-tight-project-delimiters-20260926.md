# Precision v161: tight flattened project delimiters

## System-wide correction

PDF and DOCX extraction can collapse project cards without preserving spaces
around pipes, semicolons or bullet separators. The shared project reader now
treats those separators as field boundaries only when the next token is a
recognized project label. This keeps project name, client and role values clean
without splitting ordinary punctuation inside a value.

Canonical project normalization applies the same defensive cleanup to
structured input. A lower-confidence extraction that retains a separator or a
partial `End Client` label can no longer win a merge merely because its value is
longer than the clean source-owned field.

## Verification

The regression matrix covers spaced and unspaced pipes, spaced and unspaced
semicolons, and bullet-separated cards for both `admin_upload` and
`candidate_upload`. It also covers canonical structured input and confirms the
same clean project, client and role fields for both upload sources. Reversed or
missing project dates and cross-section borrowing remain blocked.

This batch contains no candidate names, source filenames, contact details, CV
excerpts or per-file hashes. It changes no production database row, Storage
object, Auth setting or runtime configuration.

## Release status

This correction does not prove whole-archive accuracy. The broader private
evidence remains 905 originals / 892 unique contents, at least 78 short of the
970-unique-file target. Production remains `NO_GO` until a current isolated
restore and original-file recovery are verified, RLS/Auth/private Storage are
completed, and authenticated synthetic upload/OCR plus exact readback pass.

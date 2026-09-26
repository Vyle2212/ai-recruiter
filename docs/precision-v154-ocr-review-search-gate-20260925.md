# Precision v154 — OCR review and search gate

## Outcome

The shared admin/candidate CV pipeline now carries source-extraction
provenance through the persistence boundary. Any CV whose text required OCR is
saved with `needs_review`, even if its extracted fields appear complete. Review
requirements also override a caller-provided active status.

The same lifecycle decision is enforced by recruiter search, Search V2,
vector search, candidate lists, matching, persisted-match reads, direct match
writes and shortlisting. A stale active status cannot make a profile visible
when extraction is incomplete or candidate confirmation is still incomplete.

## Safety properties

- OCR output is evidence for review, not automatic proof of correctness.
- Admin and candidate uploads use the same rule.
- Fixed reason codes are persisted; OCR provider output and CV text are not.
- Review-only lifecycle fields are removed from recruiter response payloads.
- No candidate row, search-index row, Storage object or production setting was
  changed by this batch.

## Verification

- shared ingestion parity regression
- offline OCR downstream-outcome regression
- candidate lifecycle and search-surface consistency regression
- canonical search-index eligibility and exact-set repair regressions
- upload source-failure and original-retention regression
- TypeScript typecheck
- production Webpack build

Production bulk upload remains blocked until current restore evidence, private
Storage/RLS readback and a supervised synthetic upload/OCR flow all pass.

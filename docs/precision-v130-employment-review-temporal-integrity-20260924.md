# Employment review temporal integrity — 2026-09-24

## Outcome

V130 closes three timestamp-ordering gaps in the private employment review
workflow. A review snapshot is now rejected if any candidate source version is
newer than the declared snapshot capture. Finalization is rejected if it
predates the generated review pack. Every non-pending additive or conflict
decision must now be timestamped at or after both the bound source version and
the generated review pack.

These checks prevent an older decision from being reused as if it reviewed a
newly generated pack, and prevent a mixed or incorrectly timestamped snapshot
from entering the review workflow. Existing later gates still require the
backup to postdate the finalized manifest and source state, and authorization
to postdate that verified backup.

## Verification

Regression coverage includes a source version newer than its snapshot, a
finalization timestamp older than its review pack, and a reviewer decision
made after the source version but before the pack existed. The normal additive,
held, rejected and conflict-preservation paths remain covered.

No candidate identifiers, CV text, contact data, filenames or employment
payloads are included in this checkpoint. No Supabase/Vercel runtime setting
or production row was changed. The latest projection remains **737/970
sources / 2,160 employment rows**, with **233 unresolved**. Production remains
**NO_GO** pending a full current private snapshot and review, verified backup,
RLS cutover/readback, controlled backfill and search rebuild/readback, live OCR,
and authenticated acceptance on the promoted artifact.

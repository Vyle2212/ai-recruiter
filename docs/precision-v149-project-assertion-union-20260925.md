# Shared parser: project assertions (25 September 2026)

Admin and candidate ingestion use the same project merge. The canonical and
explicit label readers can recover different assignments. Choosing whichever
reader has more rows discarded valid assignments from the other reader. The
pipeline now retains an explicitly dated project when its role, period and
named project or client do not match an existing canonical project. Client-only
cards between named project cards can also be read when their own role and
duration labels are present. A second Client marker bounds the first project
so it cannot borrow a later card's date. Matching assertions are counted once.
Missing dates, reversed dates and unlabelled ownership remain subject to
existing validation and review. Two assertions for the same named project,
role and date range with different clients remain in project review.

In a read-only run on the same private collection (905 originals, 892 unique
contents), valid project rows increased from 492 to 511. Source sections
with project coverage gaps remained 175 after contradictory client assertions
were held for review. Source failures remained zero. The number of profiles
complete for validation remained **two**. The
comparison contains no filenames, identities, source passages or hashes.

Sixty-one PDFs still need employment layout/OCR review, fourteen PDFs require
OCR, and at least 78 additional unique original files are missing from a
970-unique-file target. This audit does not prove field-level accuracy and
does not authorize bulk upload. No production data or configuration changed.

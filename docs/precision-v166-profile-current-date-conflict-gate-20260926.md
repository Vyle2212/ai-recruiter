# Precision v166: profile-wide current-date conflict gate

A candidate can have several employment or project rows. Rejecting one row
with `current=true` and a historical end date was insufficient when another
valid row satisfied the minimum history check. The contradictory row could
still supply an apparent current employer while the profile entered search.

Completion now checks every structured employment and project alias. A row
with an explicit current flag and a conflicting dated endpoint adds
`current_date_conflict` to the review reasons, even when other rows are valid.
An open-ended row with an explicit current flag and a row ending `Curr` remain
eligible. This rule is shared by admin and candidate ingestion and the
downstream completion gate.

No production data or Storage object was changed. The rule does not fill
missing source evidence or prove that the original CV collection has been
parsed accurately.

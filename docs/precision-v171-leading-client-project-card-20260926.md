# Precision v171: retain a leading Client project card

Some project sections start with a `Client` assignment and introduce named
`Project` cards later. The explicit reader previously chose only Project
markers when any named card existed, so it omitted the earlier Client-only
card. It now reads a leading Client card when an explicit project heading
owns it. The card still needs its own role and dated range before the next
Project or Client marker.

Admin and candidate ingestion regressions require both cards. Negative
regressions prevent a Client in a work experience section, a section after
the project heading, or an undated leading card from borrowing the later
Project's dates.

The read-only same-population audit covered 905 original files with 892
distinct contents. Valid project rows stayed at 558, valid employment rows
at 1,859, and automatically complete profiles at four. The 779 review cases,
44 unresolved PDF layouts, 15 OCR-required PDFs and zero source failures also
did not change. These aggregate counts show no improvement on the supplied
collection and do not prove that every parsed field matches its source. No
database writes occurred; bulk upload remains blocked by the existing
readiness gates.

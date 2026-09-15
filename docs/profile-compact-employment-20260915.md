# Compact employment headings

Partial recovery, not production acceptance.

Root causes addressed:
- An explicit Organization / Designation / Duration table was ignored without an Employment History prefix.
- Now was not recognized as the end of a dated row, allowing the next row to be consumed into its title.
- Employment section headings without dash separators, and with alternative employer/title/date order, were ignored.

Recovery is restricted to the first explicit heading of an employment section or an explicit table. Client/customer/project headings and narrative summaries are excluded. Missing titles are not populated from project roles.

On the supplied 277-record employment-review export:
- Profiles with employment: 3 -> 13.
- Employment records: 25 -> 37.
- Profiles still without extracted employment: 264.
- Project records: 48 -> 48.
- Missing employment titles and dates remain unresolved.

These are results on the selected source export, not a new full-population audit. More records do not prove extraction completeness. No candidate source text or identity fixtures are committed.

Synthetic regression coverage covers four heading orders, narrative/client negatives, and standalone table boundaries with Now. Canonical employment, project identity and lifecycle regressions are also run. Full production UI verification and search score distribution remain pending. Database records are unchanged.

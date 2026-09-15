# Career consistency and recovery audit

Status: production acceptance remains blocked. This is not a claim that all profiles are parsed correctly.

## Root causes and changes

- Employment validation and career-year arithmetic used different date readers. Date.parse of a named month used the host timezone; extracting its UTC month could move the date into the preceding month. Both now share a deterministic calendar-month parser.
- Named and numeric future dates bypassed some employment validation branches. Shared parsing rejects future months and malformed ISO calendar dates.
- Numeric month/year tables, optional heading colons, `to` separators, uppercase field labels, pipe-delimited role/employer headings and date-first Position headings were missed.
- Consecutive date-only PDF cells must not be paired with concatenated employer columns by guesswork.
- An existing prose extractor could combine two `Consultant at ...` records into a third malformed employment. Date/title content is rejected in that employer capture.
- Parenthetical project names in an explicit employment table remain source evidence, not part of the employer name.
- The read-only audit now reports per-profile unresolved status, missing fields, canonical diagnostics, overlap/client equality review flags, total career years and direct FICO assignment counts.

## Selected source population

Same 277-record review export, v86 to v87:

| Metric | Before | After |
| --- | ---: | ---: |
| Profiles with employment | 25 | 42 |
| Employment records | 116 | 148 |
| Profiles without extracted employment | 252 | 235 |
| Project records | 48 | 48 |

30 profiles changed total career years: 17 with employment-count changes and 13 with unchanged counts affected by date interpretation. Direct FICO assignment counts changed for zero profiles. This is an evidence comparison, not the full Search V2 scoring distribution.

After: 118 records have titles, 147 have complete date fields, 148 have company fields. Canonical diagnostics report zero malformed narrative records, zero exact duplicates and zero invalid retained ranges. These checks cannot prove extraction accuracy. Three profiles have overlapping periods; one profile shares a client/employer name. Equality and overlap are review flags, not automatic errors. The shared client/employer case has an explicit employment-table source.

## Verification

Passed: career-date consistency (including UTC, Vietnam, Japan and Los Angeles timezones), employment table recovery, canonical employment, candidate completeness, project identity, lifecycle tests; TypeScript typecheck and production build.

An additional existing final-profile-consistency test still fails a static JSX-text assertion for Search-evidence confidence. No production completion claim is made.

## Outstanding

235 review profiles still require source interpretation or unsupported-layout recovery; missing employment titles must not be invented. The selected export is not a complete 970-profile snapshot. Full-population score distribution, all-surface authenticated checks and authenticated production UI verification remain outstanding. No database rows are changed by this branch.

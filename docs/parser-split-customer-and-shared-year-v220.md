# v220: split Customer/Company and bounded shared-year dates

Source review identified repeated table labels split as Customer then Company,
followed by a customer value, Duration, Project and Role. The shared project
reader now normalizes only complete local headers in this repeated schema.
Standalone Company records remain employment context, never inferred clients.
The explicit Project field is moved before its own client/date/role fields;
following employers or customer cards terminate the local block.

Explicit consecutive team-lead/team-member role continuation lines are retained
in that card's role. Other responsibility prose is not consumed as a role.
Elapsed durations with only a parenthesized source year, such as 7 months (2009),
remain duration_text with blank calendar endpoints. They are incomplete drafts;
no calendar months or employer dates are manufactured.

A whole explicit Duration value written Jan–May 2018 normalizes to Jan 2018–May
2018 using the existing forward same-year validation. Reversed shared-year
ranges and compound/noncontiguous shorthand periods remain unresolved. The
normalizer does not merge distinct assignments or infer a missing prior year.

Deidentified regression fixtures cover split client labels, two own roles,
parenthesized elapsed-time years, standalone employer boundaries, a forward
shared year, inverted shorthand and separate periods. Actual source review
covers BW customer/function dates and SAP Customer/Company project cards.

No database write or deployment is performed by the offline audit. Coverage
counts are not independent factual-error percentages; launch remains NO_GO
until the requested accuracy threshold is independently established. Exact
remote-head CI and production build are separate Acceptance release gates.


Standalone Company and explicit Non-SAP Project Work Experience headings now
end the preceding project card. Original-source review found a SAP assignment
incorrectly carrying January 2000–August 2001 from a later C++ employment; the
new rule keeps its SAP role but clears those unsupported endpoints. The
source-only duration stays review work, rather than becoming fabricated dates.


## Fresh source verification

All 17 production-trust dependency suites, career date consistency regressions,
TypeScript checks, scoped formatting and diff checks passed. Four final 223-file
workers processed all originals after the last functional boundary change.
The recomputed byte fingerprint matches v219. OCR was not executed.

| Measure | v219 | v220 |
| --- | ---: | ---: |
| Residual original cohort | 121 | 121 |
| Cohort project rows | 108 | 117 |
| Cohort employment rows | 312 | 312 |
| Cohort project review signals | 117 | 115 |
| Full original collection | 892 | 892 |
| Native extraction | 835 | 835 |
| Project rows including incomplete drafts | 1075 | 1075 |
| Employment rows | 1876 | 1876 |
| Observed project review signals | 249 | 247 |
| Missing required project history | 613 | 614 |
| Source failures | 0 | 0 |

Net project-row counts do not measure factual accuracy. Removing unsupported
borrowed evidence can make a profile incomplete; the additional missing-history
signal remains review work. No claim of population-wide nonregression or less
than 1% error follows from these counts. Exact v219 CI and webpack production
build passed; v220 requires its own exact-head gates.


An unseeded enrichment comparison of native source text identified two sources
with nine removed project rows under the new Company boundary. Private original
text review showed the old rows borrowed roles and/or dates across the next
Company heading: a preceding project used the following employer's contract
period, and BI/BW client cards used the following employer's position. The
records remain source-review work rather than retaining unsupported completed
project rows. This explains the nine cohort additions and unchanged full total.
The review is source-specific and does not prove all other fields correct.

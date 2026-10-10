# v218: remaining project-layout cohort

The 121-source residual project cohort comprises 109 other/narrative layouts,
9 numbered-card queue entries and 3 Client Name field sources. Queue categories
are cached diagnostic groupings, not factual-error labels. Fresh original-file
before/after parsing is used for verification, not old structured payloads.

Shared project layout normalization now recognizes literal Client Name labels,
splits tabular inline Duration fields before whitespace collapses, and accepts
numbered project headings without a colon. Year-first named-month endpoints
such as 2017 July are reordered only in explicit duration fields and only at
an endpoint start or after a range separator. Adjacent Month Year Month Year
periods remain untouched. All project readers see the same normalized fields,
preventing a second reader from emitting a truncated year-only duplicate.

Tab-plus-colon fields no longer retain a leading colon in their values. A dated
Worked/Working/Served with/for employer narrative, or Worked as role at employer
from date, ends the preceding project card. It cannot provide that client's
project role. Source cards without their own role remain review items.

Three original-source checks covered four FICO project periods (including a
literal now endpoint), six Client Name cards, and a client card lacking a role
before the next employer narrative. The last remains unresolved rather than
receiving that employer title. No company identity, personal data or source
excerpts are included in public fixtures; examples are deidentified.

Validation: all 17 production-trust dependency suites plus career date
consistency tests pass. Type checking, scoped formatting and diff checks also passed. No database writes or deployment is performed by
the audit. Exact remote-head CI and production build are still required for
Acceptance release. Less than 1% factual error is not independently established;
launch remains NO_GO. The residual narrative layouts need further source-owned
field adjudication; this batch does not claim all 121 CVs are complete.


## Fresh source results

| Measure | v217 | v218 |
| --- | ---: | ---: |
| Residual cohort originals | 121 | 121 |
| Cohort project rows | 85 | 93 |
| Cohort employment rows | 312 | 312 |
| Cohort observed project review signals | 119 | 118 |
| Full unique-original collection | 892 | 892 |
| Full native extraction | 835 | 835 |
| Full project rows, including incomplete drafts | 1034 | 1055 |
| Full employment rows | 1876 | 1876 |
| Full observed project review signals | 251 | 249 |
| Full missing required project history | 617 | 615 |
| Full source failures | 0 | 0 |

Four final 223-file audit workers completed after the last functional edit.
The collection fingerprint was recomputed from source bytes and matches v217.
The shared rule also affects sources outside the 121-case queue. These are
coverage/review metrics, not field-level factual-error percentages. OCR was
not executed: 15 OCR-required and 42 employment-layout-unresolved sources
remain controlled fallback work, rather than successful native parses.

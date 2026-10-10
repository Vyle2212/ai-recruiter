# v217: client-site cards, source-owned roles and date variants

The 48 Client-label review sources were examined from full private source text.
Two shared-reader gaps were identified: Exposure / Client’s Site table labels,
and repeated Role → Environment → Client → Project Duration cards. Only local
fields are reordered, and at least two complete repeated headers must establish
the second layout. Explicit Job Role and Position Title are project aliases;
Position Held remains an employment label because the inspected source uses it
for an employer title. Later employer/title boundaries still stop project cards.

Calendar parsing now accepts joined English month/four-digit-year tokens,
named calendar days, parenthesized numeric dates, adjacent date endpoints,
until/till separators, and Current date / Till now aliases. Ambiguous joined
two-digit tokens, impossible dates, and inverted ranges remain unresolved.
A decimal project identifier cannot become a calendar day. Explicit malformed
periods cannot borrow dates from responsibility text.

Project-duration fields also normalize the source-attested Malay month names
Mac, Ogos, Mei and Disember. The bilingual calendar in the official
[DOSM publication](https://www.dosm.gov.my/uploads/publications/20221018165600.pdf)
supports these lexical mappings. Literal source duration text is preserved.

Cards stating only elapsed time (for example 18 months or Seven Days), or
from joining date with the company, retain their own client and role with blank
calendar endpoints and duration_text. They do not inherit employer dates.
These are incomplete profile drafts: the existing self-confirm gate still
requires valid project start/end dates or a current endpoint, along with the
other mandatory fields. Retaining a row does not make it complete.

Original PDF layout was independently inspected using pdftotext -layout.
Fresh prepareCandidateCv output retains eight client-site cards with their
printed roles and periods. Legacy DOC source review covered role-before-client
ownership, joined years, Malay month names, missing local roles and reversed
dates. Source examples and personal information remain outside the repository;
regression fixtures are deidentified.

## Full original-source verification

Four completed 223-file workers freshly parsed all 892 unique originals.
The recomputed source-byte fingerprint matches the v216 collection. Auditing
pre-existing structured payloads was insufficient because those payloads could
mask dropped fresh-parser rows; the final comparison uses original files.

| Measure | v216 | v217 |
| --- | ---: | ---: |
| Unique originals | 892 | 892 |
| Native extraction | 835 | 835 |
| Source failures | 0 | 0 |
| Employment rows | 1863 | 1876 |
| Project rows, including incomplete drafts | 972 | 1034 |
| Observed project sections needing review | 259 | 251 |
| Observed employment sections needing review | 153 | 152 |
| Missing required project history | 621 | 617 |
| Missing current employer | 362 | 363 |
| Complete for validation | 7 | 9 |

The additional current-employer review item remains unresolved. Counts measure
coverage and review signals, not independently adjudicated factual accuracy.
There is no evidence yet supporting less than 1% factual error; launch remains
NO_GO. No database writes, promotion, reindexing or deployment occurred in this
batch. Exact remote-head CI and production build are separate release gates.

Validation: all 17 production-trust dependency tests, career-date consistency
regressions, and TypeScript type checking. Final scoped formatting and diff
checks must pass before publication.

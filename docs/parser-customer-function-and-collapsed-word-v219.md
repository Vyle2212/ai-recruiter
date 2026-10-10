# v219: customer/function tables and collapsed Word fields

The remaining 121-source diagnostic project cohort was freshly parsed from
original files against the v218 reference implementation. Source review found
three shared layout gaps: repeated Customer / Duration / Project Description /
Function tables, native Word lines with concatenated Duration and Position
labels, and Project Name tabular fields that follow Client and its dates.

A Customer table is normalized only when repeated Customer headers establish
the layout and a local short header contains all four literal fields. Function
becomes that card's role, rather than a global alias. Empty fields cannot consume
the following label as a value. Project descriptions remain source wording;
roles and dates come from the same bounded header.

Collapsed Word fields are split only when a line has explicit Duration and
Position labels and a date token, with no prefix or a literal Company/Project
prefix. Company is deliberately not inferred to be a project client. Partial
calendar claims stay unresolved. Multiple simultaneous source projects are
retained; no exclusive-current restriction is introduced.

Project Name/Title tab fields now use the common reader. A short Client-first
header with its own later role locally moves its Project Name before Client.
Employer and Client boundaries stop the search. Literal Duration (Month and
Year) tab fields are recognized. This retains the source client and dates for
named cards rather than leaving a misleading undated draft. Company names
are still distinct from clients.

Deidentified regressions cover local ownership, missing Function values,
concatenated labels, missing clients, partial dates and client-first named
projects separated by an employer boundary. Real original-source checks cover
BW customer/function cards, ABAP project/position cards and a tabular named
ABAP project. Private originals and source excerpts are not committed.

Coverage and review signals are not field-level factual accuracy. Less than 1%
factual error remains unproven and launch remains NO_GO. No database writes,
bulk promotion or deployment is performed by this audit. Source-held incomplete
profiles still require candidate review under the existing completion gate.
Exact remote-head CI and production build must pass before Acceptance release.


## Verification results

All 17 production-trust dependency suites, career-date consistency tests,
TypeScript type checking, scoped formatting and diff checks passed. Four final
223-file workers audited the original sources after the last functional edit.
The byte-derived collection fingerprint matches v218.

| Measure | v218 | v219 |
| --- | ---: | ---: |
| Residual cohort unique sources | 121 | 121 |
| Cohort project rows | 93 | 108 |
| Cohort employment rows | 312 | 312 |
| Cohort observed project review signals | 118 | 117 |
| Full unique originals | 892 | 892 |
| Native extraction | 835 | 835 |
| Full project rows, including incomplete drafts | 1055 | 1075 |
| Full employment rows | 1876 | 1876 |
| Full observed project review signals | 249 | 249 |
| Missing required project history | 615 | 613 |
| Source failures | 0 | 0 |

Aggregate signals are not a per-source nonregression proof. The full project
review total is unchanged even though more source-owned fields were retained.
Residual shorthand/multiple-period dates, Customer/Company split headers and
other narratives still require adjudication. OCR was not executed: 15 OCR and
42 employment-layout fallback sources remain unresolved. Exact v218 remote CI
and production build passed; v219 needs its own exact-head checks.

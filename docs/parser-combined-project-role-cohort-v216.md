# v216 combined Module / Role project cards

The shared project reader now handles explicit Module / Role values, keeping
module prefixes separate from literal project roles. A role-only value such as
PMO is retained without a fabricated module. Module-only values cannot become
roles. Project Duration is recognized alongside Duration/Period/Project Dates.
The explicit card current flag derives only from its end date.

An original PDF's Module / Role and Duration fields were inspected with native
layout extraction. Its real prepareCandidateCv output retains three Functional
Consultant project cards and one PMO card, their own periods and literal module
prefixes. Only the explicitly open-ended card is current. The previous project
omission signal for this source clears. No company dates or roles fill projects.

## Cohort and population checks

All 87 sources in the explicit-Project-label review cohort were re-enriched from
the private full-source cache. Complete project rows increased 187 to 190;
38 payloads changed, including current flag representation changes. This does
not mean 38 profiles were factually corrected. The cohort baseline is the v214
prepared cache; the current code includes v215 fixes.

All 892 originals were then processed from files in four completed workers of
223 files, using the v216 functional working-tree patch against local v215 HEAD.
This is separate from exact remote committed-head CI/build validation.

| Measure                             | v215 | v216 |
| ----------------------------------- | ---: | ---: |
| Unique originals                    |  892 |  892 |
| Native sources                      |  835 |  835 |
| Source failures                     |    0 |    0 |
| Complete employment rows            | 1863 | 1863 |
| Complete project rows               |  968 |  972 |
| Observed project omission signals   |  260 |  259 |
| Missing required project history    |  622 |  621 |
| Observed education omission signals |    0 |    0 |

Source review signals are not adjudicated factual errors. Four additional
structurally valid rows are not proof that all information in four rows is
correct; the representative source was checked separately.

Passed: TypeScript noEmit, ingestion parity, combined-field/module-only/reversed-
date regressions and all 17 production-trust dependencies. Existing source and
profile completion gates remain unchanged. No database write or deployment.
Launch remains NO_GO; population factual error rate below 1% remains unproven.

The entire 48-source Client-label cohort has also been collected privately.
Its outstanding labels include Project Duration, Job Role and Position Held.
Next reader changes must preserve card boundaries and stop employment fields
from lending dates/roles to prior clients. Remaining queues include 259 project,
153 employment, source OCR and independent source-adjudicated verification.

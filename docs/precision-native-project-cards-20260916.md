# Native project cards after reviewed source restoration

The reviewed-original backfill exposed a project omission: narrative extraction stopped at an earlier academic section, and separate PDF Project/Environment/Client/Duration lines could not form an assignment. The previous flattened projection had merged unrelated assignment evidence.

A new bounded reader finds explicitly labelled native cards inside detailed work or project history. It requires adjacent project, environment, client, duration and responsibility fields; validates chronology; stops at education/references; ignores pagination; and attaches a role only when immediately preceding the card. It does not infer an employer from the client. Repeated PDF whitespace is normalized before lifecycle classification.

The reader matches one reviewed source in the 970-source population. It recovers one distinct support assignment, with its own project name, client, role and May 2008–December 2010 dates. The project environment no longer leaks into the name. Other assignments without these explicit labels remain unresolved; this is not complete project-history recovery.

Employment coverage remains 687/970 sources and 1,997 rows, with 283 unresolved sources. Project projections increase from 155 to 156. No database write or deployed acceptance is performed in this follow-up; the seven-profile guarded backfill documented in the v86 checkpoint remains the latest write.

Validation covers academic-before-career order, adjacent assignments with different clients/dates, incomplete cards, reversed/unknown dates, role boundaries, pagination, environment/name separation and source-section termination. Eight related regression suites and typecheck passed locally. The project extractor version is incremented so the version-aware cache cannot reuse old projections.

GitHub publication of these local changes remains subject to the previously reported automatic approval block. Production remains NO_GO pending unresolved-source review, deployed OCR and authenticated acceptance against the exact release artifact.

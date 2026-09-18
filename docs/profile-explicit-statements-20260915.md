# Precision follow-up v90

Recover explicitly quoted employers in Worked/Currently working as statements, hyphenated month dates, month-day-year end dates, and till-date end labels. Recover Employer / Date of Employment or Duration before any client/project boundary. Preserve employer-only evidence without assigning the client's project role. Prevent a later Project Duration from being consumed as employer tenure. Remove grammatical articles from extracted Working-as titles.

Versions: canonical v54, employment v31, detail/cache v90.

On the supplied 277-source review export, v89 to v90: 47 to 50 profiles with employment, 156 to 167 employment records, 230 to 227 profiles without employment. Project counts and direct FICO evidence counts remain unchanged for all profiles. This is not a full-population or full-score-distribution audit.

Targeted tests cover quoted employers, three date formats, current end labels, employer-only evidence, reversed ranges and client/project date isolation. Canonical employment, ordered labels, project identity, table recovery and final-profile consistency regressions pass. TypeScript checking passes. v89 completed a production webpack build; v90 is a parser-only follow-up and has not repeated that build.

Still incomplete: the remaining 227 source layouts, a complete 970-source export and authenticated production UI validation. An audit report containing totals is not a replacement for the missing full source dataset. Do not label these cases fixed or silently assign clients as employers. No production deployment, database writes or real candidate data in commits.

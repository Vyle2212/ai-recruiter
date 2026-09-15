# Precision follow-up v91

Organization / Designation / Duration tables now support parenthesized month cells, month/year slashes and explicit non-SAP role suffixes. SAP Partner inside an employer annotation is not a role boundary. Tables stop at technical skills, training and SAP/project experience instead of consuming a following project as employment.

Employment History also supports explicit role-at-employer headings with spaced date words and digits. Repair is limited to recognized month/current words in that section. Known trailing city cells are separated from employer names. Reversed dates and explicit client/project company labels are rejected.

Read-only comparison on the supplied 277-source review export:

| Metric | v90 | v91 |
| --- | ---: | ---: |
| Profiles with employment | 50 | 56 |
| Employment records | 167 | 201 |
| Profiles without extracted employment | 227 | 221 |
| Profiles with overlapping ranges | 4 | 6 |

Six newly recovered profiles contribute 35 records. One existing profile loses one record that previously crossed into SAP Experience after a table containing several unaligned titles/date cells. The remaining 270 profiles have identical audit metrics. All project counts and direct FICO assignment evidence counts are unchanged. Date overlaps remain visible for source review; no dates are silently corrected.

Eight focused regression scripts pass: employmentTableDateLayouts, explicitEmploymentStatements, orderedEmploymentLabels, employmentTableRecovery, searchV2CanonicalEmployment, searchV2ProjectIdentitySemantics, careerDateConsistency, searchV2FinalProfileConsistency. TypeScript passes. No new production build was run for this parser-only change.

Versions: canonical v55, employment v32, detail/cache v91. The 221 unresolved profiles still require work; extracted profiles are not necessarily complete. Full 970-profile source audit, score-distribution audit and authenticated production verification remain outstanding. No database changes, deployment or candidate source data committed.

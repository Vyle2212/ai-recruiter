# Precision follow-up v92

Recover date-first employment ledgers under explicit Employment History headings: date / employer / role with pipe separators, or date / employer / role with Contract or Permanent markers. Support repeated page headings, day-month-year ranges, two-digit month years, and explicit `to date 30 Apr 2023` end dates. That phrase retains the actual end date rather than implying current employment. Reject narrative tails, client labels, reversed ranges and project sections. A department separated by hyphens stays with the employer rather than becoming part of the job title.

Date / Company Name / Role tables now also accept year-only and mixed-precision ranges. ABAP Technical Consultant is treated as a role; ABAP is not appended to the employer. Added explicit role boundaries for Application Developer and several administrative roles.

On the supplied 277-source review export:

| Metric | v91 | v92 |
| --- | ---: | ---: |
| Profiles with employment | 56 | 59 |
| Employment records | 201 | 242 |
| Profiles without extracted employment | 221 | 218 |

Three previously empty profiles recover 30, 4 and 5 employment entries. One existing profile gains two entries and gets the ABAP title/employer split corrected. The other 273 profiles have unchanged audit metrics. All project and direct FICO evidence counts remain unchanged. Overlap and client/employer conflict flag totals remain unchanged. These counters do not constitute a full scoring-distribution comparison.

Nine focused regression scripts and TypeScript checking pass, including new ledger tests for page continuation, departments, explicit end dates, project boundaries and column-major negatives. No repeat production build for this parser-only change.

Versions: canonical v56, employment v33, detail/cache v92. Still incomplete: 218 source layouts, full 970-profile source audit, authenticated production verification. No database writes or deployment, and no candidate source data committed. Recovered employment is not proof of complete extraction or independently verified current employment.

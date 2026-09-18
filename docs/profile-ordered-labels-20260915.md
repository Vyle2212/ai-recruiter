# Precision follow-up v89

Continues committed v88 (`2a3df93`) and restores the unfinished changes described in the previous conversation.

- Show search-evidence confidence for non-identity searches, using the existing evidence diagnostics. The final-profile consistency assertion passes without weakening it.
- Preserve month precision when displaying ISO dates, and label missing start/end dates explicitly.
- Recover explicit Year / Organization / Position and Position Title / Duration records inside employment sections. Stop at project, client, customer and education boundaries. Reject reversed dates. Do not infer employment from unlabelled project narratives.
- Versions: canonical v53, employment v30, presentation v10, detail/cache v89.

Read-only comparison on the supplied 277-source employment review export:

| Metric | v88 | v89 |
| --- | ---: | ---: |
| Profiles with employment | 42 | 47 |
| Employment records | 148 | 156 |
| Profiles without employment | 235 | 230 |
| Profiles with overlapping employment | 3 | 4 |
| Projects | 48 | 48 |

Only the five newly recovered profiles change their per-profile audit metrics. All 272 other profiles retain identical audit metrics. Project and direct FICO assignment counts remain unchanged for all 277 profiles. The additional overlap is explicitly present in the source and remains flagged for review; dates are not silently corrected.

Passed: ordered-label/date-display regressions, canonical employment, project identity semantics, final-profile consistency, employment table recovery, career date consistency and TypeScript checking.

Limitations: 230 selected profiles still lack extracted employment. This is not a full 970-profile audit, nor proof that recovered profiles are complete. Source dates labelled current describe the CV's claim, not independently verified current employment. Full search-score distribution and authenticated production UI verification remain outstanding. No database mutation or production deployment. Source CVs and candidate identifiers are not committed.

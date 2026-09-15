# Grounded partial employment follow-up (v88)

Explicit structured employment records were dropped unless both company and title passed validation. They now retain either grounded field and its source reference; narrative titles remain rejected. A single valid start or end date is retained without inventing Present or calculating tenure. Invalid complete ranges remain excluded from duration. Current end labels must match exactly. Search cards retain end-only dates. Audit incomplete status now includes missing company and reports missingCompanyRecords.

Versions: canonical v52, employment v29, detail/cache v88.

Synthetic regression, canonical employment, employment table recovery and candidate completeness tests passed. Typecheck and production build passed. The 277-source audit retains 42 profiles / 148 employment records / 235 unresolved profiles. All pre-existing per-profile metrics are unchanged from v87, including career years and direct FICO assignment counts. This is not a full scoring distribution audit.

Outstanding: existing final-profile consistency assertion expects a Search-evidence confidence label but the current UI disables that section and uses Search confidence. It has not been weakened to force a pass. Full 970-profile audit, remaining source layouts and authenticated production verification remain incomplete. No production deployment or database mutation performed.

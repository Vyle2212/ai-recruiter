# Functional application role recovery — v94

The compact employment-heading grammar rejected Functional Application Consultant because it accepted Functional Consultant only. Add the optional Application word in that role prefix, keeping the existing explicit section and heading boundaries. The title specialization is preserved and employer location/narrative is excluded.

The supplied 277-source review subset now contains 62 profiles with 261 employment records; 215 still have no extracted employment. Compared with v93 exactly one profile gains one grounded record. Projects, direct FICO assignments and diagnostics are unchanged: malformed 0, duplicates 0, invalid ranges 0, overlapping profiles 7, possible client/employer conflict 1. This is not a complete 970-profile audit.

The new regression checks the recovered employer/title/date plus project-section and responsibility-text rejection. Existing table recovery, canonical employment and final profile consistency tests pass, as does typecheck.

GitHub confirms both Vercel deployments for v93 completed successfully. This does not establish authenticated acceptance or production promotion. Vercel and Supabase connections are confirmed by the user, but neither exposes callable operations in the current session. Do not request reconnection or credentials; resume database and deployment inspection when those operations become available. Release remains NO_GO under production-trust-release-promotion.md until exact deployed artifact acceptance is verified.

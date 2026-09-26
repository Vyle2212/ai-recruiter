# v125 complete API authorization coverage

The production API inventory contains 142 route files and 173 exported HTTP
methods. This batch closes 14 previously uncovered business methods across 13
legacy route files:

- CV upload, parsing and multi-CV analysis;
- match explanation and recruiter email generation;
- Candidate 360 profile, analyst and self-confirmation preview;
- import staging, merge proposal and merge preview reads;
- taxonomy discovery read and write.

The proxy now requires an authenticated recruiter session and the appropriate
permission before these handlers can read candidate evidence, invoke OCR/AI,
consume external-provider capacity or mutate candidate/taxonomy data. Upload
and multi-document routes have explicit request-size bounds. The taxonomy POST
and CV upload routes are marked as persistent service-role mutations.

The authorization regression now enumerates every exported API method. A
method must have a proxy policy, enforce recruiter authorization locally, or
be named in the explicit public exemption set. The only exemption is the
pseudonymous release-evidence endpoint, which independently returns 404 unless
both the acceptance environment and acceptance test mode are enabled. Current
coverage is 173 methods, one explicit exemption and zero uncovered methods.

No candidate identifier, contact detail, CV text or import payload is recorded
in this checkpoint. Source projection remains 737/970 sources and 2,160 rows,
with 233 sources lacking extracted employment. Stored production inventory
remains 231/970 sources and 715 rows. The 533 additive sources still require
private review and the 108 conflicts still require adjudication.

No Supabase or Vercel production state changed. Production remains NO_GO until
private review, verified backup, conflict adjudication, controlled RLS and
backfill/index promotion with readback, live OCR and authenticated acceptance
on the exact promoted artifact are complete.

# Legacy candidate response privacy checkpoint (2026-09-24)

Two legacy recruiter responses still returned more candidate data than their clients used. The candidate audit query selected direct email and phone values even though its UI only needs contact-presence flags. The validation mutation returned the entire persisted candidate row even though its UI consumes only the derived validation state.

This batch removes email and phone from the audit projection, marks the audit response private/no-store, and limits validation mutation responses to the derived validation state. A deterministic source contract protects both boundaries. Candidate names and professional fields remain available to the authorized recruiter audit because they are required to identify the review item; direct contact and source-CV payloads are not returned.

No production data was changed. The source projection remains the last verified **737/970 sources and 2,160 employment rows**, with **233 sources** lacking employment. This is not a new population comparison because the private source archive remains unavailable in this workspace. Stored production inventory remains **231/970 sources and 715 rows**. Review queues remain **533 additive sources** and **108 conflicting sources**.

Production remains **NO_GO** pending private review and conflict adjudication, verified backup, reviewed backfill/readback and exact-set search reconstruction, RLS cutover/readback, live OCR, and authenticated acceptance on the promoted artifact.

# Precision v139 — candidate-owned profile confirmation (2026-09-25)

## Outcome

This code-only batch connects the candidate portal to the same extraction and
quality rules used by admin upload, then adds the missing fail-closed step from
`needs_review` to a searchable profile. It does not install SQL, enable a
runtime flag, upload a CV or change production data.

- The portal derives the candidate from the verified Auth session and the
  one-to-one account mapping. It no longer accepts a browser-supplied candidate
  ID. The searchable email is pinned to the verified sign-in email rather than
  an unverified CV or form value.
- Candidate CV replacement uses the shared SAP extraction pipeline. Non-SAP,
  ambiguous and incomplete output remains blocked from normal search.
- Confirmation requires name, contact, current role and employer, location,
  employment history, SAP modules, technical skills, project history,
  education and languages. Accuracy consent and sharing consent are separate
  mandatory decisions.
- Candidate can add, correct or remove structured employment, SAP project,
  education, language and certification rows before confirmation; incomplete
  parser output is not a dead end and does not require an administrator to edit
  the profile manually.
- Employer tenure remains distinct from project and client history. A missing
  date stays missing; only an explicit Current/Present marker creates a current
  row.
- One PostgreSQL transaction row-locks the verified profile, account and
  candidate, checks the exact candidate version, writes the confirmed fields,
  records the extraction/consent evidence and replaces the exact
  `candidate_search_index` row. A stale version or failed readback rolls back
  everything.
- Existing profile provenance and latest-CV metadata are retained. Contact or
  identity ownership cannot be reassigned by the browser.
- The mutation requires `CANDIDATE_PROFILE_CONFIRMATION_ENABLED=true`; it is
  off by default. The manual RPC requires forced RLS and is executable only by
  `service_role`; a separate read-only artifact verifies the installed
  contract.

## Verification

Local verification passed for candidate profile confirmation, portal
ownership, self-confirm completeness, admin/candidate parser parity,
candidate-owned CV update, lifecycle/search invalidation, recruiter API policy
coverage, Search V2 authorization/cache privacy, private-data RLS cutover,
typecheck and whitespace integrity. Synthetic fixtures contain no candidate
identity, contact information or private CV text.

## Data result and remaining gates

No private source archive was available in this GitHub-only run, so the
employment projection is unchanged at **737/970 sources and 2,160 rows**. The
remaining **233 sources** still require reprocessing from the complete original
970+ CV collection; they were not discarded. This batch does not claim parser
accuracy on those unavailable originals.

Production remains **NO_GO** until the production Auth foundation, private
Storage and forced-RLS/RPC cutover are installed under supervision and pass
readback; a synthetic candidate completes signup, claim, CV upload, OCR,
confirmation and authenticated search acceptance; and the complete 970+ source
re-upload is audited for identity resolution, duplicate handling, extraction
coverage, non-SAP rejection and exact search visibility. The owner should not
upload the collection yet.

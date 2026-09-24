# Precision v137 — candidate-owned CV update contract (2026-09-24)

## Outcome

This batch prepares the candidate side of the shared CV ingestion pipeline. It
does not enable the route, install SQL, create accounts, upload CVs or mutate
production.

- Admin and candidate CVs use the same extraction, SAP classification,
  completeness and quality gates.
- Candidate upload is disabled unless the server-only
  `CANDIDATE_CV_UPLOAD_ENABLED=true` cutover flag is explicitly set.
- The browser never chooses a candidate identifier. A current verified Auth
  user must resolve to exactly one active `user_profiles` row, one active
  `candidate_accounts` row and one candidate row.
- The original CV stays in the private `candidate-original-cvs` bucket under
  the verified Auth user UUID. PDF, DOCX and TXT remain limited to 10 MiB.
- A non-SAP document or rejected resume is removed before any candidate row is
  changed.
- The candidate-owned update locks profile, ownership mapping and candidate,
  rejects a stale `updated_at`, preserves explicitly candidate-confirmed or
  recruiter-approved fields and updates only an allowlist.
- CV-extracted email and phone never replace confirmed contact identity.
- A successful CV replacement becomes `claimed_incomplete` / `needs_review`.
  Its old search-index row is deleted in the same transaction. Search remains
  closed until required fields are fulfilled and the candidate explicitly
  confirms accuracy.
- The RPC is `security invoker`, has an empty `search_path`, and is executable
  only by `service_role`; `PUBLIC`, `anon` and `authenticated` are revoked.

## Files

- `lib/candidateCvAuthorization.ts`
- `app/api/candidate/profile/cv/sign/route.ts`
- `app/api/candidate/profile/cv/route.ts`
- `lib/saveCandidate.ts`
- `supabase/manual/202609240014_candidate_owned_cv_update.sql`
- `supabase/manual/202609240015_candidate_owned_cv_update_readback.sql`
- `scripts/candidateOwnedCvUpdate.test.ts`

## Verification required before enablement

1. Verify a current restorable production backup.
2. Run and read back the production Auth foundation, private Storage bucket,
   candidate claim, full-profile fields and the complete forced-RLS cutover.
3. Install `014` only in a supervised window and run read-only `015`.
4. Test candidate sign/upload/process with a verified synthetic candidate and
   a real SAP CV, including non-SAP, stale-version, ownership-conflict,
   incomplete-profile and concurrent-update negatives.
5. Verify the updated candidate is absent from every search surface until the
   required-field form is complete and accuracy is confirmed.
6. Only then enable the server flag and invite the full 970+ admin re-upload.

## Data checkpoint

No private source set was available in this GitHub-only run, so the extraction
population is unchanged: 737 of 970 sources produced structured employment,
with 233 still requiring original-CV reprocessing. No candidate, CV, contact,
Supabase or Vercel production data was written.

Production status remains **NO_GO**. CI or preview success is not runtime,
OCR, full-population, security-cutover or authenticated acceptance evidence.

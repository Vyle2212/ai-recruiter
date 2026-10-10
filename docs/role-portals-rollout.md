# Role portal rollout

The portal work is incremental. None of these screens by itself certifies the CV parser or authorizes the bulk import.

| Role | Implemented foundation | Release dependency |
| --- | --- | --- |
| Admin | Production admin route and original-CV approval flow | Production RLS/policy review, authenticated acceptance and deploy |
| Candidate | Signed CV upload and confirmation flow using the shared parser | Original-file storage and candidate acceptance checks |
| Client | Authenticated membership-scoped overview, candidate/job sharing, gated candidate lookup and detail | Client entitlement schema, approved access links, lookup migration, subscription tests |
| Recruiter | Existing Search V2, shortlist/Compare Pack and gated Assigned Work from client shares | Recruiter share migration, assigned-work authorization tests and deploy |

## Recruiter Assigned Work

`RECRUITER_SHARED_WORK_ENABLED` is **off by default**. When set to `true`, the recruiter dashboard routes to `/recruiter/assigned-work`. The page accepts only an active authenticated recruiter. Its SQL functions return 20-item cursor pages only when all of these remain active: client share, recruiter assignment, candidate access or job ownership, and the client's dated `recruiter_support` entitlement. The functions grant execution only to `service_role`; they do not grant original CV access.

On a new target, apply `supabase/manual/202609270009_production_client_memberships.sql`, `supabase/manual/202609260006_recruiter_client_entitlements.sql`, then `supabase/manual/202609270007_recruiter_shared_work.sql` where `public.candidates` and `public.jobs` exist. These are now applied on production, with forced RLS on the new tables and zero membership, entitlement or share rows. Verify cross-client denial, revocation, entitlement expiry, pagination and zero-row behavior with synthetic accounts before enabling the flag. Keep it off until the existing production candidate/job direct-access exposure is resolved and real assignment links are reviewed.

The client lookup uses a separate flag, `CLIENT_CANDIDATE_LOOKUP_ENABLED`, and requires `supabase/manual/202609270006_client_candidate_lookup.sql` as described in `docs/client-candidate-lookup-rollout.md`.

## Candidate/job direct access cutover status (2026-09-27)

The application scan found no browser-side `.from("candidates")` or `.from("jobs")` call. The browser Supabase clients in candidate/admin upload pages address Storage only. The server candidate/job routes normally use the service-role client and their HTTP access is governed by the route policy/proxy. Four remaining reads/writes have been moved off session or anonymous fallback: latest job, repair review, AI extraction apply, and candidate audit loader. TypeScript, repair review and route authorization checks passed locally.

PR #7 still has failed Vercel statuses for both projects due the Hobby build-rate limit, so the revised code has **not** been exercised in a deployed Preview. There are no provisioned client/recruiter assignment or entitlement rows to exercise live share/search permissions. Do not apply the proposed `202609270008_production_candidate_job_direct_access_lockdown.sql` until the updated build is deployed and authenticated candidate, admin, recruiter and client flows have been checked against an isolated test environment. After that, apply the reviewed lock in production and verify service-role reads, `anon`/`authenticated` denial, Search V2, upload, shortlist, original CV approval, and job flows. Keep both portal flags off until those checks pass.

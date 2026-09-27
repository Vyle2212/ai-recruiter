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

Apply `supabase/manual/202609260006_recruiter_client_entitlements.sql` and then `supabase/manual/202609270007_recruiter_shared_work.sql` on a target with `public.candidates` and `public.jobs`. Verify cross-client denial, revocation, entitlement expiry, pagination and zero-row behavior with synthetic accounts before enabling the flag. The current production schema does not have the required client share/entitlement tables. Keep the flag off there until the existing production RLS exposure is resolved and the migrations and real assignment links are reviewed.

The client lookup uses a separate flag, `CLIENT_CANDIDATE_LOOKUP_ENABLED`, and requires `supabase/manual/202609270006_client_candidate_lookup.sql` as described in `docs/client-candidate-lookup-rollout.md`.

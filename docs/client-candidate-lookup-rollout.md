# Client candidate lookup rollout

Status: disabled by default (`CLIENT_CANDIDATE_LOOKUP_ENABLED` must equal `true`). This lookup is a scoped name/title/company search, not the recruiter Search V2 ranking experience.

## Current production readback (2026-09-27)

`public.candidates` has UUID `id` and text `name`, `current_title`, `current_company`. The production project does **not** yet have `public.client_candidate_access`, `public.client_feature_entitlements`, or `public.client_candidate_lookup(uuid,text,uuid,integer)`. The client portal and API must stay disabled or fail closed until the dependencies are applied and verified.

## Deployment sequence

1. Complete the production RLS and policy review for existing candidate data. Do not treat the new service-role API as a substitute for fixing broad direct table access.
2. Apply `supabase/manual/202609260006_recruiter_client_entitlements.sql` on the target project. Verify client membership and recruiter assignment tables and their service-role-only grants.
3. Apply `supabase/manual/202609270006_client_candidate_lookup.sql` where `public.candidates` exists. The function is invoker-security, grants execution only to `service_role`, and independently joins each result to active `client_candidate_access` for the requested client.
4. Assign active client memberships and candidate access using an approved client-to-candidate source of truth. Do not infer client ownership from a candidate's employer or project client. Provision a dated active `unlimited_search` entitlement for the intended plan.
5. On an isolated test client, check: anonymous/other role denied; inactive membership denied; expired entitlement denied; unrelated candidate absent from search and direct detail; active candidate visible; original CV still requires its separate approval route. Check page 2, empty results, and revoked access.
6. Enable `CLIENT_CANDIDATE_LOOKUP_ENABLED=true` only after the migration, data links, authorization checks, and target deployment are verified. Keep it disabled if the target project lacks `public.candidates` (the current acceptance project does).

The API uses a 20-result keyset page and a maximum 120-character query. Its response returns only name, current title and company. The detail API verifies active access for the specific candidate before reading its record, then projects overview, employment, projects, education and skills without raw CV or contact fields. Employment dates and project dates remain separate.

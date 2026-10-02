# Candidate CV acceptance prerequisites

The isolated acceptance database `iujucosewivndjpcjbuz` had no candidate or
candidate-account rows before these changes. Its private original-CV bucket and
forced RLS on candidates, candidate accounts, user profiles and search index
were verified before applying the migrations. No production schema or data was
changed.

Applied acceptance-only migrations on 27 September 2026:

1. `acceptance_candidate_cv_profile_fields_20260927`: guarded by the acceptance
   environment marker and empty candidate/account tables. Source is
   `supabase/manual/202609270009_acceptance_candidate_cv_profile_fields.sql`.
   It adds the profile provenance, extraction coverage and confirmation fields.
2. `acceptance_candidate_owned_cv_update_20260927`: the function from
   `supabase/manual/202609240014_candidate_owned_cv_update.sql`, prefixed with
   the same acceptance marker guard. The readback in `202609240015` passed.
3. `acceptance_candidate_profile_confirmation_20260927`: the function from
   `supabase/manual/202609240016_candidate_profile_confirmation.sql`, prefixed
   with the same guard. The readback in `202609240017` passed.

Both functions are security invoker, keep an empty search path, grant EXECUTE
only to `service_role`, and revoke it from `public`, `anon` and `authenticated`.
The readback scripts accept PostgreSQL's `search_path=""` catalog rendering of
an empty path; the owned-CV readback also matches the doubled quotes in the
dynamic SQL definition.

The synthetic TXT regression `scripts/candidateUploadLifecycleAcceptance.test.ts`
runs the shared admin/candidate parser, checks employer and client project
separation, an undated project, confirmation gating and Search V2 visibility.
It is wired into production-trust CI and the authenticated acceptance workflow.

HTTPS upload, private original-file readback and confirmation still require a
run-owned candidate/account/storage fixture, acceptance-only runtime flags,
and a READY deployment at the exact PR head with acceptance service-role
configuration. Until those tests and cleanup pass, keep portal flags off and
do not apply the production candidates/jobs direct-access cutover.

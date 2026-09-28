# Internal-first acceptance decision (28 September 2026)

Vy approved completing the internal Talent Hub database, CV, Search V2 and role
flows before validating any external talent provider. This changes the order of
work, not the evidence required for a full release.

## Current evidence boundary

- PR #7 commit `b6caa47` had a READY deployment on the separate
  `ai-recruiter-acceptance` project. Its protected release endpoint classified
  the deployment as acceptance, with external talent disabled and no approved
  provider configuration.
- Authenticated acceptance workflow run #19 failed at release preflight with
  `acceptance_external_required_configuration_missing`. The synthetic fixture,
  four-role browser tests and cleanup were not reached. This is **not** an
  internal acceptance pass.
- A request to run the existing full workflow with `external_mode=disabled` was
  rejected by auto-review. Do not repeat that action or infer a pass from the
  existing `PASS_INTERNAL_ONLY` report type. A separately scoped internal test
  path needs its own review before dispatch.

## Work order and release gates

1. Keep improving code and local synthetic tests for parser extraction,
   candidate confirmation, search and shortlist, private original CV access,
   jobs/share and role boundaries. A local pass is code evidence only.
2. Prepare an explicitly named internal acceptance run with exact deployed SHA,
   acceptance-only fixtures and verified cleanup. Its report must say
   `internal_only`; the external suite must remain untested and the full release
   decision `NO_GO`.
3. After an authorized internal run passes, assess remaining runtime gaps and
   then separately configure and test the approved external provider.
4. Keep production portal flags off and do not apply candidates/jobs direct
   access cutover until all applicable acceptance and production readbacks pass.

Never substitute a preview deployment without the service-role configuration,
or a READY build at another SHA, for acceptance evidence. Recheck the current
PR head before every live run.

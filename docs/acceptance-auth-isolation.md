# Acceptance authentication isolation

The acceptance runtime uses its own explicit opt-in. It does not satisfy or replace staging approvals.

In the isolated Vercel acceptance project, retain APP_ENV=acceptance, ACCEPTANCE_TEST_MODE=true, the environment ID and project reference. Add:

- ACCEPTANCE_AUTH_ENABLED=true
- ACCEPTANCE_SUPABASE_PROJECT_REF_ALLOWLIST=iujucosewivndjpcjbuz
- ACCEPTANCE_PRODUCTION_PROJECT_REF_DENYLIST=hcohaxcojpudauftbntx,grppxoecxmltiqxelukf

The public Supabase URL must be the exact HTTPS origin of the allowlisted project. Alternate server/candidate URLs are rejected. Known live project references are always denied. Missing configuration blocks protected portal pages and recruiter APIs with HTTP 503; login remains disabled. Configured portal access still requires a valid Supabase user, active profile and permitted role. Password reset email is disabled for Acceptance.

Do not deploy until the reviewed commit is selected explicitly. Updating this branch does not change the existing acceptance release branch. Do not set ACCEPTANCE_DEPLOYED_SHA manually; obtain identity from VERCEL_GIT_COMMIT_SHA.

Run npm run test:acceptance-auth plus the staging runtime factory and Supabase adapter tests, typecheck and production build. Authenticated deployed UI validation remains required. The subsequent fixture change serializes experience and education as JSON text and confidence values as text, matching the selected database schema. Fixture version is v2. Synthetic candidate and lease tests plus typecheck passed after this change. This does not constitute population employment timeline or authenticated UI verification.

Local validation: clean npm ci; TypeScript --noEmit passed; Next.js 16.3.5 production build passed. Seven targeted suites passed: acceptanceAuthConfiguration, stagingAuthRuntimeFactory, stagingAuthSupabaseRuntimeAdapter, stagingAuthRuntimeActions, stagingAuthRuntimeActionService, portalRouteGuards, stagingAuthRuntimeUi. The last suite had an obsolete preview-only assertion already inconsistent with the base commit's real login form; updated to assert runtime form use and absence of preview actions. No deployed UI verification performed.

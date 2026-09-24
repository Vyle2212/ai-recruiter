# Precision v135 — production Auth foundation

Date: 2026-09-24  
Scope: code and reviewed-run artifacts only; no Supabase/Vercel configuration or production write

## Outcome

The repository now has one production-specific Auth foundation chain instead of relying on the staging-only schema:

1. `202609240011_production_auth_foundation.sql` creates the minimum organization, user-profile and one-to-one candidate-account model; enables and forces RLS; exposes only the authenticated user's own profile as read-only; and keeps all mutation server-only.
2. `202609240012_production_initial_owner_bootstrap.sql` binds a single initial admin to an already existing, email-confirmed Supabase Auth identity. It does not create or modify an Auth user and records non-secret project/bootstrap provenance in a private schema.
3. `202609240013_production_auth_foundation_readback.sql` is repeatable-read/read-only and fails unless RLS, grants, policy count, private-schema isolation, verified initial-owner identity and candidate ownership invariants all match.

The candidate ownership model gives a new candidate account `pending_claim` status with no candidate ID. It cannot enter the protected portal until the verified, conflict-safe claim step succeeds and atomically activates the account. Admin bulk upload remains independent: it creates or updates canonical candidate data without creating candidate accounts.

## Fail-closed boundaries

- Existing or partially installed target objects abort the foundation artifact.
- `anon` receives no access.
- `authenticated` receives only self-profile `SELECT`; no browser table mutation is granted.
- Candidate-account ownership is unique on both user-profile and candidate sides.
- Bootstrap requires one pre-existing, confirmed Auth email and refuses a second active admin/provenance row.
- The claim primitive remains unavailable to browser roles until signup/claim runtime acceptance passes.
- CI executes both the production foundation regression and the shared admin/candidate profile-lifecycle regression.

## Population status

This batch does not change the parser projection or any production record. The latest source result remains 737/970 sources and 2,160 projected employment rows; the replacement workflow still requires the full original 970+ CV collection and live full-population audit.

## Release decision

Production remains `NO_GO`. None of these SQL artifacts has been installed. Required evidence still includes a current restorable backup, supervised foundation/bootstrap execution and passing readback, production login/signup and claim acceptance, private original-CV storage, live OCR, full 970+ upload audit, RLS cutover/readback and exact-artifact authenticated acceptance. Vy should not upload the CV collection yet.

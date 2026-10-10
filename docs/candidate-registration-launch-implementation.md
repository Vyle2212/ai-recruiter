# Candidate registration implementation and launch evidence

Status: registration implemented behind OFF gates; live email onboarding unverified.

## Implemented boundaries

The candidate-only signup UI, bounded POST registration handler, isolated
public-key SSR signup and PKCE callback are implemented. Registration remains
disabled by default. Signup releases only the verifier cookie after a neutral
pending result; callback releases session cookies only after fresh verified
Auth and successful ownership provisioning. Installed SSR tests use mocked
transport and prove verifier continuity and tampered-verifier denial. They do
not prove email delivery or a live public signup.
Candidate upload requires a fresh verified Auth user, exactly one active
candidate user_profile, one matching active candidate_account and an existing
candidate record. Creating an Auth user alone does not satisfy onboarding.

Run #65 proves an owned administrative Auth transition and preconfirmation
chat denial, not public signup or email delivery.

## Ownership and onboarding requirements

1. Add candidate-only registration behind a separate explicit registration
   runtime gate. Keep portal gates off while implementing and testing.
   Validate bounded name/email/password input and reject role, organization,
   candidate_id and existing-profile identifiers supplied by the browser.
   Never derive authorization from user_metadata.
2. Use public-key Auth signup with email confirmation. Use a configured,
   allowlisted application callback origin; never accept a browser-provided
   redirect URL. Return a neutral result for existing addresses.
3. Complete the callback using the current supported Supabase SSR flow.
   Resolve identity with fresh getUser and require email_confirmed_at.
   An unconfirmed session must not create ownership or upload/search/chat.
4. Provision candidate ownership on the server through a reviewed atomic
   transaction: create a new candidate plus one candidate user_profile and
   candidate_account for the verified Auth subject. Retry must return the
   same ownership chain. A pre-existing client/recruiter/admin identity or
   conflicting chain must fail closed without overwriting its role.
5. Existing imported profiles require a separate reviewed claim operation.
   Do not merge or attach them by name, email text or client-supplied ID.
   Reconciliation decisions remain separate from public registration.
6. After confirmed onboarding, redirect to the candidate dashboard and use
   the existing owned upload, parse, confirmation and search lifecycle.
   Do not mark incomplete extraction or unconfirmed profiles search-ready.

## Acceptance evidence required

Use a run-owned synthetic address and approved isolated email capture.
Never send test mail to arbitrary addresses or print verification tokens.
Track Auth creation before subsequent writes so failure cleanup can find it.

- Real signup request, neutral duplicate-address response and bounded inputs.
- Captured confirmation delivery and exact allowlisted callback.
- Preconfirmation ownership/upload/chat denial.
- Confirmed callback creates exactly one complete ownership chain.
- Callback replay is idempotent; wrong token, expired token, wrong origin and
  cross-role existing identities do not gain candidate privileges.
- Upload -> parser -> confirmation -> authenticated search using that chain.
- Consent and subscription chat gates plus original-CV approval gates.
- Cleanup of captured mail, sessions, Auth and all run-owned records; zero residue.

SQL007 has been applied and verified on acceptance project
`iujucosewivndjpcjbuz`. SQL003 through SQL007 must never be reapplied. New schema
changes require their own exact review; signup approval does not authorize
production changes.

## Configuration handoff before live signup

Keep registration OFF until these acceptance-only values are reviewed:

- `CANDIDATE_REGISTRATION_SUPABASE_PROJECT_REF` must identify the acceptance
  project and match the configured Supabase origin exactly.
- Configure the reviewed registration callback origin and allow its exact
  `/auth/candidate/callback` redirect in acceptance Auth. Require email
  confirmation; an immediate signup session is rejected by the handler.
- Configure the acceptance Turnstile site key and matching Auth CAPTCHA
  provider secret through safe secret entry. Never substitute a production
  key or disable CAPTCHA to make a test pass.
- Configure `ACCEPTANCE_REGISTRATION_CAPTURE_EMAIL` to an owned capture
  mailbox and a reviewed provider adapter. The adapter must query only the
  run-owned alias, preserve envelope recipients and receipt time, and support
  bounded capture plus deletion of the captured message. No real mailbox,
  provider token or confirmation URL belongs in source or workflow artifacts.
- Persist the exact run intent before signup and record the discovered Auth
  identity before subsequent writes. Editable Auth metadata alone is not
  deletion authority. Partial signup failure still requires owned cleanup.

The capture contracts validate exactly one recent message and an exact
Supabase signup confirmation URL. Provider failures and timeouts are
sanitized. A live provider adapter and delivery evidence remain outstanding.
These mocked contracts do not justify enabling registration.

After reviewed configuration, enable registration only on acceptance,
deploy the dynamic PR HEAD through the approved path, and require exact
Production READY plus fresh release SHA/build/classification/configuration
proof. Then dispatch one materially new protected workflow on the allowlisted
branch and wait for Vy's Environment review. Do not spend protected runs for
OFF preparation, rerun run65, or treat a READY Preview as acceptance proof.

## Launch sequence

Finish registration and source/identity reconciliation; configure Google Vision
during launch preparation and prove native-first scanned-CV OCR; verify the
external provider when configured and authorized; obtain a fresh isolated
restore and reviewed production RLS/Storage/Auth comparison. Only then review
the production cutover and portal enablement. Internal acceptance PASS is
insufficient to enable production.

## Prepared protected signup acceptance

The Gmail credential-only preflight has passed for the dedicated test mailbox.
A gated browser journey now submits the real candidate signup form with its
configured CAPTCHA, persists the run intent before sending, binds the discovered
unconfirmed Auth identity, reads the exact run-alias confirmation, verifies one
Auth/profile/account/candidate chain, removes only the captured message, and
revokes refresh sessions for the bound identity. Confirmation URLs, cookies,
credentials and mailbox message IDs stay out of screenshots, traces and evidence.

The existing protected authenticated-acceptance workflow has an optional
`include_signup` input, default false. Only the E2E step receives Gmail secrets
when that input is true. Identity and database cleanup retain their existing
always-run steps. The report permits a skipped signup only when it was not
requested, and requires signup PASS plus cleanup verification when requested.
Mocked journey/report contracts verify these boundaries; they do not prove
live delivery, real CAPTCHA completion, or successful public onboarding.

Registration remains OFF. Before requesting one protected live run, verify the
acceptance Auth CAPTCHA provider and exact callback allowlist, review the exact
PR SHA and enable registration only on `ai-recruiter-acceptance` Production.
The journey fails before signup if the deployed release is not that reviewed SHA,
registration is not configured/enabled, Gmail credentials cannot refresh, the
run fixture is not ready, or the proposed run identity already exists.
This signup proof is separate from remaining replay/duplicate-address and the
full onboarding-to-upload/search acceptance requirements above.

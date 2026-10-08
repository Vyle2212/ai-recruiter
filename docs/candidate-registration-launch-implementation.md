# Candidate registration implementation and launch evidence

Status: implementation required; not a launch approval.

## Observed gaps

At PR #7 commit 3e9d961d8e9aba73e181a2dc9ea09b9ae6dae348, /auth/signup renders a DisabledForm.
No public signUp call exists under app, lib or utils. The staging runtime
supports sign-in, reset, invitation and session operations, not registration.
Candidate upload requires a fresh verified Auth user, exactly one active
candidate user_profile, one matching active candidate_account and an existing
candidate record. Creating an Auth user alone does not satisfy onboarding.

Run #65 proves an owned administrative Auth transition and preconfirmation
chat denial, not public signup or email delivery.

## Required implementation order

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

Email capture/configuration and any new ownership transaction need explicit
acceptance configuration and platform review. Existing SQL003/004/005/006
must not be repeated or modified to bypass this requirement.

## Launch sequence

Finish registration and source/identity reconciliation; configure Google Vision
during launch preparation and prove native-first scanned-CV OCR; verify the
external provider when configured and authorized; obtain a fresh isolated
restore and reviewed production RLS/Storage/Auth comparison. Only then review
the production cutover and portal enablement. Internal acceptance PASS is
insufficient to enable production.

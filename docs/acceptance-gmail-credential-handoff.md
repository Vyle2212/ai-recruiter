# Acceptance Gmail preparation

The user reports storing ACCEPTANCE_GMAIL_CLIENT_ID, ACCEPTANCE_GMAIL_CLIENT_SECRET
and ACCEPTANCE_GMAIL_REFRESH_TOKEN in the acceptance GitHub Environment. This report
does not prove the values work; do not retrieve or print their values.

Production Trust Foundation CI now has an optional manual
verify_gmail_credentials input. On codex/production-admin-auth only, it runs
a separate acceptance Environment job after the existing review gate.
Secrets are supplied only to the credential preflight step, not install or tests.
That step refreshes via Google's fixed token endpoint and reads only Gmail
profile to require vjvjan.le@gmail.com. PASS_CREDENTIALS_ONLY is not signup,
capture, email delivery or cleanup evidence. The branch/SHA must be reviewed
before any secret-bearing run. No push or PR event runs the credential job.

The shared in-memory credential helper also prepares the run-alias read-only
Gmail capture runtime. It requires explicit ACCEPTANCE_GMAIL_CAPTURE_ENABLED=true,
acceptance mode, exact project iujucosewivndjpcjbuz, configured callback origin,
and persisted run-intent alias. The helper has no public route and is not called
by signup or existing E2E flows. Keep it OFF until the full capture/cleanup
integration and configuration have been reviewed.

Current gmail.readonly credentials cannot delete messages. Do not treat moving
mail to Trash as zero mailbox residue or silently request broader scopes.
The existing cleanup contract requires provider.remove followed by readback
absence; a real reviewed removal adapter is still missing. Public signup remains
OFF, and live registration acceptance remains unverified. No production DB,
portal or Auth configuration is changed by this preparation.

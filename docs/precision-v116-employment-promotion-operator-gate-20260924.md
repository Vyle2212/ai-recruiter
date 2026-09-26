# Employment promotion operator gate — 2026-09-24

## Outcome

V116 adds the controlled operator path for the v115 single-transaction
Supabase adapter. The default mode is read-only. It loads one private bundle,
recreates the complete v114 preflight, and emits only counts and fingerprints.
The bundle must resolve outside the repository, and matching private filename
patterns are ignored by Git as an additional protection against accidental
candidate-data commits.

The flow deliberately has three review stages:

1. manifest plus current source state produces the candidate-set,
   source-state, manifest and preflight fingerprints without requiring a
   database credential;
2. a version-matched, readback-verified backup is added and checked against the
   exact candidate set and source-state fingerprint;
3. release authorization is added only after the backup and must name the same
   commit, manifest and preflight fingerprints.

This removes a circular approval dependency: reviewers can see the sanitized
fingerprints before signing authorization, while an incomplete bundle can
never enter write mode.

## Write-mode controls

The operator invokes the RPC only when every independent control agrees:

- explicit `--write` on the command line;
- `EMPLOYMENT_PROMOTION_WRITE_ENABLED=true`;
- the checked-out full Git SHA equals the reviewed target SHA;
- the expected Supabase project ref matches the ref parsed from the HTTPS
  `SUPABASE_URL` hostname;
- a server-side `SUPABASE_SERVICE_ROLE_KEY` is present;
- the exact confirmation contains the action, commit SHA, preflight
  fingerprint and project ref;
- both verified backup evidence and final authorization exist in the private
  bundle.

Supplying write controls without `--write`, using a custom/unverifiable URL,
checking out another commit, changing the bundle, omitting the service-role
credential or changing one confirmation character fails closed. The service
client is imported only after all controls pass. No anon key is accepted.

The command is:

`npm run run:production-employment-promotion -- --bundle=/absolute/private/path`

It remains a dry run unless the separate write controls above are supplied.
The public output never serializes candidate identifiers or employment rows.
After a successful RPC it still reports production acceptance as incomplete
and requires rebuilding and reading back the invalidated search-index rows.

## Verification and limits

Synthetic regression covers review-only, backup-verified and fully authorized
phases; private-path refusal; exact commit/project/confirmation binding;
missing service-role refusal; sanitized reporting and write-mode ambiguity.
The v114 transaction and v115 Supabase adapter regressions continue to pass,
as do TypeScript and formatting checks.

This batch did not create a real private manifest or backup, did not initialize
a production client, and did not call Supabase or Vercel. The 533 additive
sources still require private review evidence, the 108 conflicts remain
blocked, and controlled installation/backfill/search rebuild/readback, live
OCR and authenticated exact-artifact acceptance remain required. Production
remains **NO_GO**.

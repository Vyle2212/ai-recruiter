# Private employment release authorization — 2026-09-24

## Outcome

V119 replaces the remaining plain authorization object with a deterministic
private release-authorization artifact. Authorization can only be prepared
from a v118 backup-ready operator bundle plus the complete persisted private
backup artifact. It is bound to the exact commit, manifest, preflight,
candidate set, source state, backup evidence and backup fingerprint.

The release owner must supply an exact confirmation containing the target
commit, preflight fingerprint and backup fingerprint. The artifact and the
resulting operator bundle are written outside the repository with owner-only
permissions, reopened from disk and fingerprint-verified. The public report
contains aggregate counts and fingerprints only.

This step proves approval integrity but does not enable a write by itself.
Runtime write controls, the exact Supabase project and service-role credential
are still required separately by the dry-run-first operator.
Fingerprints detect changed content; they are not a cryptographic proof of the
release owner's identity. A human must verify the operator and private inputs.

## Fail-closed controls

- Authorization requires a verified backup-ready bundle and refuses an
  existing authorization.
- The complete private backup is reverified against the bundle before approval
  can be created or attached.
- The release owner, timestamp and exact confirmation are mandatory;
  authorization cannot predate the backup.
- Both the persisted private artifact and the embedded execution authorization
  have independent immutable fingerprints.
- Execution authorization is tied to the exact backup evidence, preventing a
  valid approval from being reused after backup state changes.
- Private inputs and outputs must remain outside the repository, use owner-only
  permissions and cannot overwrite existing files.

## Command

After private review and v118 backup verification, the operator derives the
confirmation from the reviewed commit, preflight fingerprint and backup
fingerprint, then runs:

`npm run prepare:production-employment-authorization -- --bundle=/private/backup-ready.employment-promotion-private.json --backup=/private/backup.employment-promotion-private.json --authorization=/private/authorization.employment-promotion-private.json --output=/private/authorized.employment-promotion-private.json --authorized-by=<release-owner> --confirm=<exact-confirmation>`

The command initializes no Supabase client and performs no database write.

## Verification and limits

Synthetic regression covers a valid backup-bound authorization, sanitized
reporting, wrong confirmation, missing release owner, timestamp predating the
backup, persisted-artifact tampering and duplicate authorization refusal. The
v112-v118 promotion regressions remain required.

No private 970-source review pack, backup or authorization was available in
this run. No Supabase/Vercel state changed. Real review, conflict adjudication,
fresh backup, controlled RLS/adapter install, backfill plus search
rebuild/readback, live OCR and authenticated exact-artifact acceptance remain
required. Production remains **NO_GO**.

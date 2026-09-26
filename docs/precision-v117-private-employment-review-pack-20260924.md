# Private employment review pack — 2026-09-24

## Outcome

V117 closes the missing review-artifact step between the read-only 970-source
projection and the v116 production operator. A private candidate snapshot can
now be converted into one review pack that covers every source and records the
five promotion queues. Only additive and conflict queues carry private review
items; unchanged and still-empty sources remain counted but cannot enter a
write manifest.

The review pack contains the source text, complete current employment state,
complete parser projection and exact promotion plan needed for human review.
It must stay outside the repository. The command refuses repository paths,
refuses overwrite, requires the private filename suffix, and creates the file
with owner-only permissions. Standard output contains aggregate counts and
fingerprints only.

The immutable pack fingerprint binds:

- the exact target commit and snapshot timestamp;
- all source versions and existing employment payloads;
- all private source text and parser projections;
- every queue and proposed promotion plan.

Review decisions are deliberately excluded from that fingerprint so a reviewer
can record a decision without regenerating the technical evidence. Finalization
rebuilds every plan from its bound inputs and fails if any immutable content
changed.

## Review and conflict behavior

Every additive source must receive an explicit `approve_additions`, `hold` or
`reject` decision with reviewer identity and a valid timestamp. Pending
additive decisions block the entire finalization. Only approved additive plans
enter the private v116 operator bundle; held and rejected plans are counted but
excluded.

Conflict sources can never use `approve_additions`. A reviewed `reject`
decision means the unsafe parser projection is rejected and the stored history
is retained unchanged. Pending or held conflicts remain explicitly
outstanding. This lets the 108-source conflict queue be adjudicated without
silently replacing or deleting any stored tuple.

The finalized operator bundle intentionally contains neither backup evidence
nor release authorization. Its public report says `readyForBackup: true` and
`readyForWrite: false`; the later v116 gates still require a version-matched
backup, exact authorization, commit/project confirmation and the single
transaction RPC.

## Commands

Prepare a private review pack from an outside-repository snapshot:

`npm run prepare:production-employment-review -- --source=/private/snapshot.json --output=/private/review.employment-promotion-private.json`

After private review decisions are recorded, finalize the additive operator
bundle:

`npm run finalize:production-employment-review -- --review=/private/review.employment-promotion-private.json --output=/private/operator.employment-promotion-private.json`

Both commands bind the artifact to the exact checked-out full Git SHA. No
Supabase client is created by either command.

## Verification and limits

Synthetic regression covers all five queues, complete additive decision
requirements, approved/held paths, conflict rejection while preserving stored
history, conflict-approval refusal, invalid decisions, immutable-content
tampering, sanitized reports and private file controls. TypeScript and scoped
formatting checks pass.

This batch did not have a private production snapshot available, so it did not
create the real 533-source review pack or adjudicate the 108 conflicts. It did
not initialize a Supabase client, install SQL, write production data or change
Vercel. Real private review, backup, controlled backfill and search-index
readback, live OCR, RLS cutover and authenticated acceptance remain required.
Production remains **NO_GO**.

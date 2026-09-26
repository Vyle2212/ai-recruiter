# Reviewed additive employment promotion gate — 2026-09-24

## Purpose

The v112 production comparison proved that a replacement backfill is unsafe:
108 sources conflict with stored history and 223 stored tuples would be removed
or changed. This batch converts that finding into a fail-closed code boundary.

`lib/productionEmploymentAdditivePromotion.ts` builds a private review plan for
one source at a time. It supports only the two additive queues identified in
v112:

- 506 sources whose stored employment is empty and whose projection is
  populated;
- 27 sources whose stored tuples are all retained and whose projection proposes
  additions.

The 108 conflicts, 100 unchanged sources and 229 still-empty sources are not
write-eligible through this gate.

## Review and concurrency contract

An approved merge requires all of the following to match the reviewed plan:

1. candidate identifier and source `updated_at` value;
2. SHA-256 fingerprint of the complete ordered stored employment payload;
3. SHA-256 fingerprint of the complete ordered parser projection that would be
   persisted;
4. SHA-256 fingerprint binding the exact proposed additions, queue, row counts,
   conflict count and write-eligibility state to the source and both prior
   fingerprints;
5. an explicit `approve_additions` decision, reviewer identity and valid review
   timestamp that does not predate the source version.

Any changed source version, concurrent stored-history edit, changed parser
projection, altered metadata, duplicate/concurrent stored row, changed queue,
altered additions, missing reviewer evidence or non-additive plan fails closed.
The merge copies every stored row first and appends only the
reviewed additions. Missing source dates stay missing; the gate does not invent
an end date or convert it to `Present`.

## Verification and scope

Synthetic positive and negative regressions cover additive preservation,
conflict rejection, stale-source rejection, concurrent-change rejection,
tampered-plan rejection and missing-date preservation. The test uses no real
candidate identity or CV content. The gate is wired into Production Trust CI.

This batch supplies the review/merge contract only. It does not generate or
commit a private approval manifest, execute a candidate update, rebuild a
search index, or change Supabase/Vercel configuration. Actual writes still need
the reviewed private manifest, an exact pre-write backup, optimistic
`id + updated_at` matching, post-write readback and production authorization.

Production remains **NO_GO** pending reviewed additive backfill/readback,
adjudication of the 108 conflicts, live OCR, authenticated exact-artifact
acceptance, verified backup and controlled RLS cutover/readback.

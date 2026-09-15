# Production Trust release promotion

An authenticated acceptance run on a feature branch validates only the exact
commit SHA and deployment hash recorded in its sanitized report. A later merge
or squash creates a different revision and is not production evidence.

The release owner must use one of these promotion paths:

1. Deploy the exact protected release or main SHA after merge, then dispatch the
   acceptance workflow against that SHA and its HTTPS deployment.
2. Promote the immutable build artifact whose commit SHA, build ID and
   deployment hash already passed acceptance, without rebuilding it.

The release gate remains NO_GO until the promoted artifact identity matches the
accepted identity. Branch-only PASS_INTERNAL_ONLY or PASS_FULL_SCOPE means the
scoped acceptance suite passed; it is not authorization to deploy a different
commit.

## Latest code-only checkpoint

Parser commit `d91380801c128d4f9a700131aeab4a87de94ca07` passed the full
Production Trust push and pull-request workflows, including the mandatory CV
source-layout regression group. Both preview statuses also succeeded. This is
code, build and preview evidence only: it did not run live OCR, mutate or
backfill the database, audit the remaining 693 declared sources, or perform
authenticated acceptance against the exact deployable artifact. The release
gate therefore remains NO_GO.

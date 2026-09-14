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

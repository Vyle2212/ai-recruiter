# Source-owned career records and duplicate location cells — 2026-09-23

## Source review and correction

The same private 970-source snapshot was compared before and after this
revision. Three sources have supported corrections. A consulting-firm role
followed by a freelance client assignment had produced an extra employer
from the client line; the correct consulting employer and its original
start/end dates remain. An explicit Company/Position history had retained
labelled responsibility prose inside two non-SAP job titles. Another career
history had read a role title as an employer and had duplicated two jobs
when one reader kept the trailing city in the company cell.

General rules now keep a freelance `Job ... as <role>` assignment out of
employer extraction, stop a title at a labelled responsibility field, reject
a role-shaped employer in the dated prose reader, retain `Senior` in an
explicit `Senior SAP ... at <company>` title, and consolidate identical
title/date/employer claims when one contains an explicit trailing city.
Different role titles or dates remain distinct. De-identified positive and
negative cases are mandatory CI regressions. Parser version v96 invalidates
stale employment and SAP-duration projections.

## Full-source read-only comparison

On unchanged inputs, there are **705/970 sources with employment and 2,049
employment rows**, compared with 705/970 and 2,053 before. Exactly four
unsupported duplicate or client-as-employer rows were removed across two
sources; two non-SAP titles were trimmed in a third. All retained start/end
dates and current markers in the three sources remain source-owned; all
other 967 sources have identical employment tuples. SAP experience and
project counts are unchanged in **all 970 sources**. Malformed, duplicate
and invalid-range counts remain zero; overlap review flags decrease 58 to
56, and possible client/employer flags remain two. **265 sources still
require review**. These are heuristic review cases, some without SAP jobs.

No original CV, candidate name, source excerpt, identifier or contact detail
is included in this checkpoint. No database write, runtime setup or release
promotion occurred. Production is **NO_GO** pending reviewed backfill and
readback, live OCR with saved provenance, source review and authenticated
acceptance on the exact promoted artifact.

# Canonical search-index rebuild boundary — 2026-09-24

## Data issue and change

The standalone index rebuild included a second, permissive builder. When the
application's canonical builder rejected a candidate with no trusted primary
SAP module, a rejected status or an untrusted display name, the fallback could
infer a module from raw skills and insert the candidate anyway. It also printed
candidate identifiers in console output and accepted a browser/anonymous key.

The rebuild now uses only `buildCandidateSearchIndexRow`, requires the server
service-role key for reads, and reports aggregate counts without identifiers.
The standalone command is read-only: `--write` is refused before connecting;
the optional existing-row refresh only previews canonical eligibility.
The package command supplies Next.js's server condition, so the canonical
builder imports successfully during the read-only plan without making a
database connection merely to run this import regression.
Sanitized regression examples cover a
valid primary module, skills-only input, a rejected profile, an untrusted name
and an already indexed profile. No real search index or candidate was changed.

## Count and release checkpoint

The latest available read-only projection remains **737 / 970 source records
with employment and 2,160 rows**; **233** sources remain without extracted
employment. The last stored-data inventory remains **231 / 970 records and
715 employment rows**, with **739** records lacking stored employment. There
are **533** additive review candidates and **108** conflicting records that
must be adjudicated. Before and after this code change these counts are
unchanged because the private 970-source snapshot could not be materialized in
this run; the Library transfer returned a transient 502. Those source groups
retain their documented heading/date, project/client, labelled employer,
table, narrative and missing-source reasons. No person-specific pattern or
identifier was added.

This standalone script cannot perform the release index rebuild: it does not
provide an exact-set transaction, backup or source-version readback.
The controlled backfill invalidates affected index rows; reviewed rebuilding
and readback of the exact promoted set remain required. Private source review,
conflict resolution, backup, RLS cutover, live OCR and authenticated acceptance
on the exact artifact remain outstanding. Production is **NO_GO**.

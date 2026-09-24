# Precision v141 — canonical search index eligibility

Date: 2026-09-25

## Result

The search-index audit now uses the same canonical row builder as the write path. Lifecycle status alone is not sufficient: an otherwise visible candidate must also satisfy the data-quality requirements needed to build a valid search row.

A read-only, aggregate-only production check corrected the previous interpretation:

- four lifecycle-visible candidates were reported as missing from the index;
- all four fail canonical row construction because required name and SAP-module data is invalid or incomplete;
- therefore zero candidates are both canonically indexable and missing from the index;
- 93 currently indexed candidates are lifecycle- or quality-blocked and must be removed by the future exact-set repair;
- no orphan, duplicate, or stale index rows were found.

No candidate identifiers, names, contact data, CV content, or source filenames are recorded here.

## Changes

- `buildSearchIndexAudit` accepts the exact candidate IDs emitted by the canonical builder.
- Both server and command-line audits derive eligibility through `buildCandidateSearchIndexRow`.
- The command-line audit requires a service-role credential and no longer prints sampled candidate IDs.
- Regression coverage proves that lifecycle-visible but incomplete candidates remain excluded.

## Production status

No production data, configuration, or search row was changed. Production remains `NO_GO`.

Before bulk upload can open, the exact-set removal must run transactionally with readback, RLS/auth cutover must be verified, backup restoration evidence must pass, and real OCR/upload acceptance must be completed. The 970+ original CV set is still required only when the controlled bulk-upload step is explicitly opened.

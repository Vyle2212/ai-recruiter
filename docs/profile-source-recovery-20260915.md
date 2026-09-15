# Profile source recovery — partial implementation, production NOT verified

The supplied candidate database export retains the employment table and education
in raw_text/resume_text. Structured experience and education are null; imported
current_title/current_company contain a professional-summary sentence. Running
the existing normalizer reproduces zero employment records and three projects.

The new explicitly headed Date / Company Name / Role table reader supports
flattened PDF text, EXPERINCE, month/two-digit-year dates (00–30 => 2000–2030;
31–99 => 1931–1999), page markers and separate Client labels. Project tables are
excluded. Ambiguous role narratives remain responsibilities/evidence with an
unknown title, rather than a fabricated job title. Invalid ranges are not used
as employment periods by the existing validator.

Observed against the user-supplied record locally: zero to 12 employment
records and zero to one education record. Separate periods at the same employer
remain separate, and client labels do not become employers. Three rows have no
explicit title. Project omissions remain; no direct FICO assignment is created.
No actual candidate source, employer names, dates or education is included in
the committed regression fixture: it uses six entirely synthetic table rows.

Changed production files: lib/candidate360Employment.ts,
lib/candidate360SchemaNormalize.ts, lib/searchV2Shared.ts. Normalization,
employment and Search/cache versions were incremented.

New tests and fixture: scripts/employmentTableRecovery.test.ts and
scripts/fixtures/employment-date-company-role.json (entirely synthetic). New read-only inventory:
scripts/auditProfileSourceRecovery.ts. It paginates candidates in ID order,
reports source availability and possible omissions, serializes hashed identifiers
rather than names/source excerpts, and never updates database rows. A source
reference alone does not establish that an original file is accessible.

Validation: table regression PASS; canonical employment regression PASS; exact
project identity regression PASS; tsc --noEmit PASS; production build PASS
(138 pages, five existing dynamic-filesystem tracing warnings).
Canonical overview test FAILS on a static expectation that the unmodified drawer
imports CanonicalProfileOverview. Population lifecycle test cannot run without
tmp/search-v2-runtime-snapshot.json. No full-population or scoring delta claimed.

Remaining gates: obtain/read complete current snapshot; audit names and omitted
projects; address other CV layouts; compare scoring using identical queries and
as-of dates; validate A8CCB8/Indra original records; verify all affected surfaces
and authenticated UI. No database writes or production promotion performed.

Windows, from a checkout containing this patch and its existing .env.local:

    node --env-file=.env.local --import tsx scripts/auditProfileSourceRecovery.ts --output profile-source-audit.json

Do not delete/re-upload candidates. Retain IDs, recruiter edits, notes and
shortlists. This patch alone does not complete the systemic remediation.

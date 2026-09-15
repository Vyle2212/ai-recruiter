# Sample-based recovery follow-up — incomplete, no production approval

Same-input comparison on 23 user-provided, warning-selected source exports:
employment records 35 -> 55; profiles with employment 5 -> 7;
education records 2 -> 11; profiles with education 2 -> 8.
These are not a random population sample or an accuracy measurement. Exports
omit some database fields, so sample counts are not the full-row population audit.

The patch handles explicit Date / Company Name / Role tables with non-SAP
roles, parenthesized durations, and following section boundaries; it also handles
Organization / Designation / Duration tables without carrying project narratives
into employment. Education recovery adds Degree / College-University / Year,
highest academic qualification, and degree-separator-institution formats. It
rejects combined multi-degree qualification strings. Unknown dates are preserved
as unknown; clients and project assignment qualification rules remain separate.

New regression data is entirely synthetic. No uploaded CV content is committed.
The supplied samples are only read locally. The database is not modified.

Validation: employment table, canonical employment and exact project identity
regressions PASS; TypeScript PASS; production build PASS with the same existing
five dynamic-filesystem tracing warnings. These checks do not supersede the
previous documented overview test failure or missing population fixture.

Versions: canonical v44, employment v23, Search/detail/cache v80. The read-only
source inventory can now consume the samples export via --input as well as read
the candidate database. No full population comparison or score-distribution run
was possible without a current source snapshot/database access.

Still unresolved: narrative employment layouts, other education layouts,
collapsed words, identity verification across the dataset, incomplete project
extraction, missing role titles and authenticated production UI verification.
No claim that all 970 profiles are fixed; no re-upload or database rewrite advised.

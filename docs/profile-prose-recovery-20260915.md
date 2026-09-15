# Prose heading recovery — partial, production not verified

Same 23 warning-selected source exports: employment records 55 -> 63,
profiles with employment 7 -> 10; education records 11 -> 12,
profiles with education 8 -> 9. These are extraction counts, not accuracy
or population estimates. No database writes.

Adds employer/dash/role/month-range headings within explicit professional or
employment history sections. Sentence-boundary handling prevents preceding
responsibilities becoming an employer. Project sections and undated summaries
are excluded. School/range/degree extraction is restricted to the beginning of
an education section because flattened extracurricular text can otherwise be
misread as part of the next school name. Remaining ambiguous records are not
fabricated. All new committed fixtures are synthetic.

Versions: employment v24, canonical v45, Search/detail/cache v81.
Employment-table/prose/education-boundary regressions, canonical employment,
exact project identity and production build including TypeScript PASS. Five
existing dynamic-filesystem tracing warnings remain. Earlier documented
unrelated overview static test failure is not resolved by this patch.

The two newly flagged population tokens are absent from the provided source
samples. Their cause cannot be established from aggregate reports alone.
Remaining gates include other layouts, name validation, all projects, scoring
distributions, full snapshot comparison, A8CCB8/Indra actual-source verification,
and authenticated real-profile UI. This is not a production release sign-off.

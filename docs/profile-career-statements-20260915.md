# Career statements and audit scope — v95

Three source layouts were omitted: dated role-at-employer sentences in Career Summary; Organization/Period tables without a title column; and numbered Work Experience headers with ordinal or hyphenated dates. Recovery requires those explicit headings and retains the employer/role/date boundary. Employer-only tables stay incomplete rather than borrowing titles from later client projects.

On the supplied review subset, compared with v94: employment profiles 62 → 65, records 261 → 272, profiles without employment 215 → 212. Exactly three profiles change. Projects and direct FICO assignment counts are unchanged. Diagnostics remain malformed 0, duplicate 0, invalid-range 0, overlap flags 7, possible client/employer conflict 1. Two new employer-only records explicitly lack titles.

The audit now reports its scope: 277 audited sources, 970 declared population, 693 unaudited sources, SUBSET_ONLY. Neither extraction count nor a full declared population proves source correctness. These missing sources cannot be audited from the supplied summary counters.

Validation: 14 employment/presentation/canonical regression scripts and typecheck passed. New synthetic fixtures exercise employer/title separation, date normalization, reversed-date rejection and project-boundary rejection. No private CV text is committed. No database records were changed.

Production remains unverified. Both connected plugins are confirmed, but live Supabase/Vercel operations are still absent from the execution environment. Authenticated acceptance must run against the exact deployed artifact per production-trust-release-promotion.md before production promotion. The user's authorization to complete fixes and deploy remains in force; do not ask for generic permission again.

# Employer metadata boundaries — v98

Recover dated employment headings with parenthesized former employer names and an explicit Work Description boundary. Preserve the former name as employer metadata and retain the role qualifier. Recover dated employer summaries before Job Experiences without using an assignment title as the employer role.

On the 277-source subset, two profiles each gain one employment record: 70 employment profiles / 277 records; 207 remain without employment. One recovered record has no employer-level title in source and stays INCOMPLETE_EMPLOYMENT. Projects/direct FICO counts and all diagnostics are unchanged: malformed/duplicate/invalid ranges 0, overlap flags 7, possible client/employer conflict 1. The declared population is 970; 693 sources remain unaudited.

Validation: 17 regression scripts and typecheck passed. Synthetic fixtures cover former-name/title separation, rejected project sections, reversed dates and assignment-role isolation. No private CV content committed or database writes performed. Production remains unverified: connected Vercel/Supabase live operations are absent from this runtime, and exact-artifact authenticated acceptance has not run.

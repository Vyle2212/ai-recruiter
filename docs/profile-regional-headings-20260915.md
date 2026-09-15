# Regional employment headings — v96

Recover explicit role/PT.-prefixed-employer/date headings and SAP-role/date/employer-pipe headings. Parsing remains anchored at employment section starts and excludes client/project/narrative headings. Reject reversed date ranges before entry normalization; otherwise normalization could drop invalid dates while retaining the job.

Supplied 277-source subset: v95 65 profiles / 272 employment records → v96 67 / 274; 210 profiles still lack employment. Exactly two profiles gain one record each. Projects, direct FICO evidence and diagnostics are unchanged. Malformed/duplicate/invalid-range counts are zero; seven overlaps and one possible client/employer conflict remain for source review. Full declared population is 970, with 693 sources unaudited.

Validation: 15 synthetic/canonical/presentation regression scripts and typecheck passed. New tests cover PT. prefixes, role/date/employer ordering, reversed ranges, responsibility text, client labels and project section boundaries. No private CV content committed. Production acceptance is still unverified and requires live access to the already-connected Vercel/Supabase services; their callable operations remain absent in this session.

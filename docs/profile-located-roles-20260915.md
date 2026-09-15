# Located employment role headings — v97

Recover employment headings containing a corporate employer, explicit location cell, dotted month/year range and Role label. Keep location out of the company name. Bind dates before Role and do not borrow project duration from the following Project section. Reject reversed dates and client/narrative headings.

The supplied subset gains one profile/record compared with v96: 68 employment profiles, 275 records, 209 profiles without employment, out of 277 audited sources. Declared full population is 970; 693 sources remain unaudited. Projects/direct FICO counts and diagnostics are unchanged: malformed/duplicate/invalid-range 0, overlap flags 7, possible client/employer conflict 1.

Validation: 16 employment/canonical/presentation regression scripts and typecheck passed. Synthetic fixtures cover company/location/title separation, dotted dates, project-date isolation and rejected false headings. No private source records committed or database writes performed. Exact-artifact authenticated acceptance and production promotion remain unverified. Vercel/Supabase connections are confirmed, but live operations still are not exposed in this runtime.

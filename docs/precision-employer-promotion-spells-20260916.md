# Employer promotion and contract spells — v87

The remaining source review found explicit employment spans with internal promotions, worked-at statements with numeric month dates, bullet-separated titles and repeated employer headings with contract/permanent periods. Their fields were present in the source but were not being recovered.

The new readers retain the employer's own tenure boundaries. Promotion dates must fall within the stated length of employment; subsequent companies and education sections end the record. Numeric dates are handled within worked-at statements. Dotted day/month/year dates are validated against the actual calendar. Separate contract and permanent spells are preserved. Client names and project durations do not complete employment records.

Complete comparison against the exact published ff83c927 baseline, using the same reviewed 970-source snapshot:

- Four previously empty sources recover 13 employment rows.
- All 1,997 prior employment tuples remain exactly unchanged.
- New totals: 691 sources with employment, 2,010 employment rows, 279 sources still without extracted employment.
- Malformed, duplicate and invalid-range rows remain zero; overlap flags remain 57 and client/employer equality flags remain two.
- Projects remain 156; project-type gaps remain 15. Missing employment titles remain 118 and incomplete employment date ranges remain 42.

The first comparison detected an unnecessary punctuation change to an existing employer. The reader was narrowed and the full comparison repeated; the final result changes only the four recovered sources.

Local verification: 24 mandatory source/layout/date/OCR suites plus three canonical/Search V2 suites, typecheck and whitespace checks pass. The new regression includes nested promotions, distinct employer boundaries, invalid calendar dates, missing employer labels, reversed periods, numeric day-date fragments and contract/permanent separation.

An additional original PDF was retrieved and visually checked during review. Its table labels several organizations as Client, not Employer. That source remains unresolved for employment ownership; it was not rewritten to turn customers into employers. Original files and candidate identities remain private.

No database write was performed in this batch. The previously verified seven-original backfill remains the latest data update. Runtime publication, database backfill, semantic source acceptance and deployment acceptance are distinct gates. Production remains NO_GO pending unresolved/incomplete source review, reviewed backfill where appropriate, deployed OCR and authenticated acceptance on the exact release artifact. The prior direct Vercel project request returned 403 Forbidden.

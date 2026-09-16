# Original CV layout verification — 2026-09-15

## Changes

PDF extraction now orders positioned text by visible rows, preserves word and column gaps, and keeps cells together for two explicitly headed employment-table formats. The table renderer is scoped to each document and retains original text rather than substituting employer names. Canonical employment receives the preserved source rather than a whitespace-flattened string.

DOCX extraction uses Mammoth's public document transform to retain soft line breaks. Its raw-text converter discarded those breaks, fusing titles and employers. Images and HTML are not emitted by this path.

The employment reader supports line-bounded company/date/title headings, role/Employer/Client tables, wrapped end years, and role/company/date headings. Client engagement dates are not copied into employer tenure. Duration-only table cells retain an explicit start without inventing an end date. Adjacent starts one month apart are not deduplicated when an end is missing. Education and detailed project sections remain outside this reader.

## Original-source evidence

Seven original PDFs (32 pages total) and one corresponding DOCX were inspected locally. No original CVs, names, contact details, or OCR text are committed. Before this change the uploaded PDFs each produced zero canonical employment rows through the upload parser.

| Source layout | Employment rows after repair | Complete date ranges | Qualification |
| --- | ---: | ---: | --- |
| Corrupted PDF character mapping | 5 | 5 | Requires locally rendered OCR text; direct PDF upload is still unresolved |
| Five-column employment ledger | 11 | 2 | Nine ends are unspecified; duration alone does not establish an exact end |
| Sidebar heading and wrapped dates | 9 | 9 | Contract clients remain separate from employers |
| Company / scope / year table | 5 | 5 | Includes an explicitly overlapping part-time engagement |
| Reordered content stream | 3 | 3 | Education and projects excluded from employment |
| Company and role with right-aligned dates | 6 | 6 | Community and education entries excluded |
| Employer/client tables plus older role headings | 20 | 10 | Actual PDF and DOCX yield identical company/title/date tuples |

Total: 59 employment rows across seven CVs, including the five rows from offline OCR. This is not a claim of 59 distinct employers, complete candidate profiles, or successful production backfill. The OCR employment row labelled only “Current Position” leaves its title unassigned. The revised employer/client CV differs from the previously exported source version.

Character-inventory checks on all 32 PDF pages found no lost non-whitespace characters relative to the PDF text items. This checks text retention, not semantic reading-order correctness or OCR quality. Employment sections were also visually compared with the originals.

## Regression and release status

Synthetic tests cover PDF row ordering, fragmented words, both table formats, multi-page table continuation, per-document renderer isolation, DOCX soft breaks, client-date isolation, section boundaries, wrapped years and partial-date deduplication. Existing canonical, pinned-fixture, source-preservation and employment-pattern regressions were run. Typecheck and the webpack production build pass.

With the subsequent parser checkpoints documented in `cv-ocr-upload-release.md`, the unchanged 277-source export now yields 100 profiles / 357 employment rows, with 177 profiles without employment. Original files have not been written back to that export or the database; the 59 original-file rows must not be added to its counts as if backfill had occurred. The other 693 sources remain unaudited. Existing malformed, duplicate and invalid-range diagnostic counts remain zero.

Production remains NO_GO. The subsequent upload OCR integration is documented in `cv-ocr-upload-release.md`; live service verification remains outstanding. Authenticated database backfill, full-population audit, and deployed-SHA acceptance remain outstanding. Runtime Supabase/Vercel changes are outside this automated GitHub-only scope. No production data writes or production promotion were performed.

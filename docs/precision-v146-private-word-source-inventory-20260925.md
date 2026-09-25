# Private Word-source inventory — 2026-09-25

## Measured private batch

The private Word archive contains 363 CV files plus one directory entry:

| Format | Files | Shared parser status     |
| ------ | ----: | ------------------------ |
| DOCX   |   192 | Audited                  |
| DOC    |   170 | Unsupported; fail closed |
| RTF    |     1 | Unsupported; fail closed |

The archive contains 357 unique byte sequences and six duplicates. Its unique
format counts are 189 DOCX, 167 DOC and one RTF. On commit
`8fbd5493f3a10bc744a0b045e1e037e127384526`, the shared admin/candidate parser
produced 484 valid employment rows and 193 valid project rows from the DOCX
group. After the generalized labelled-project parser batch at
`9e945b3ac3dd1af949d89ade5656620cc434ea0d`, the same DOCX population retained
all 484 employment rows and increased to 203 valid project rows. Missing
project-history counts fell from 138 to 136 and observed-but-unstructured
project sections fell from 64 to 62. It found no DOCX read failure. There were
still 50 accepted sources without valid employment:

| Employment gap queue     | Sources |
| ------------------------ | ------: |
| Near career heading/date |      21 |
| Project/client-heavy     |      19 |
| Headed table             |       5 |
| Explicit employer label  |       4 |
| Other narrative/layout   |       1 |
| Short or missing source  |       0 |

This is a private-batch aggregate, not a claim about the complete 970-source
population. Names, filenames, contact data, source excerpts and per-file hashes
were not written to the repository.

## System-wide audit correction

The offline audit now inventories DOC and RTF alongside PDF, DOCX and TXT, then
records 168 unique legacy files as an explicit fail-closed source failure. It does not
attempt to interpret binary DOC as UTF-8 and does not silently omit the rest of
the batch. The upload parser remains limited to PDF, DOCX and TXT until a safe,
tested legacy conversion path exists.

The PDF archive could not be materialized in this run because its private-file
transfer repeatedly returned HTTP 502. Therefore the complete original-file
classification and same-population before/after comparison have not run.

Production remains **NO_GO**. The outstanding gates still include the complete
970+ original-file audit, real OCR, restore evidence, Auth/RLS/Storage cutover,
reviewed backfill/readback and runtime acceptance.

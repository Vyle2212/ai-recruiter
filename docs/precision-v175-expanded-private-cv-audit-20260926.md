# Expanded private CV collection: same-system audit

The two newly supplied ZIP archives contain 840 CV files and 818 distinct byte
contents; 36 of those contents overlap the previously supplied archives. The
combined private collection has 1,745 CV files and 1,674 distinct contents.
Other archive entries, including an executable, are excluded from CV ingestion.
Distinct documents are not distinct people: multiple versions still need
identity and version reconciliation against production candidate records.

The shared admin/candidate parser was run offline on all 1,674 byte-distinct
CVs without OCR network calls or database writes. The aggregate is six complete
for validation, 1,428 needing review, 94 classification reviews (12 non-SAP,
four job descriptions, 78 unknown), 15 quality rejections, 36 requiring OCR,
94 unresolved PDF employment layouts and one source failure. It recovered
3,623 valid employment rows and 916 project rows. No candidate names, contact
details, excerpts, filenames or per-file digests are serialized here.

Generic name parsing now prioritizes explicitly supplied or header identity
over email aliases, rejects document titles and standalone field labels, and
contains no candidate-specific email overrides. On the same 1,673-document
population, the first name correction changed no aggregate completion,
employment-gap or source-failure count. The later standalone-label correction
passes focused regression and CI. PDF.js standard fonts are now resolved from
the installed package and traced into the upload Functions; a real private PDF
no longer emits missing-font warnings. Same-population aggregate counts remain
unchanged after this font configuration.

One DOCX (14,855,900 bytes) exceeds the former 10 MiB intake limit. Offline
parsing recovers one employment row and holds the profile for review. The
prepared 20 MiB limit is shared by admin/candidate upload paths, OCR, private
Storage SQL and cutover readback. The production Storage global limit was read
as 50 MB; its private bucket remains at 10 MiB until the separately reviewed
cutover step runs. No production bucket, candidate, Auth, RLS or Vercel setting
was changed.

Production remains **NO_GO** pending a recent isolated restore, the private
data/RLS and Storage readbacks, authenticated exact-revision acceptance, live
OCR, identity/version reconciliation, and source-grounded review of incomplete
CVs. The parser does not invent absent employers, dates, projects, languages
or education to increase the automatic-completion count.

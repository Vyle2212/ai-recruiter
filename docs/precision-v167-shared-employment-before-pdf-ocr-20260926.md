# Precision v167: consult shared employment before OCR

The PDF text gate previously asked one canonical employment reader whether a
PDF's readable text contained employment history. If that reader found none,
the entire PDF went to OCR before the admin/candidate ingestion pipeline could
run its other bounded readers. A private same-collection probe found valid
employment rows from the shared parser in a subset of the 60 affected PDFs.

PDF extraction now consults the same full-pipeline employment coverage before
requiring OCR solely for an unresolved employment heading. This applies to
both admin and candidate uploads. An incomplete or missing page, too little
text or broken encoding still triggers full-document OCR. If shared parsing
cannot establish the whole observed employment section, OCR remains required.
After OCR, the same rule accepts recovered employment from the shared parser;
uncertain fields remain in review and cannot enter search.

On the same 905 originals (892 unique contents), the read-only audit moved 15
CVs from the blocked PDF layout group into review. Unresolved employment-layout
PDFs fell from 60 to 44; valid employment rows rose from 1,819 to 1,841 and
valid project rows from 555 to 560. One PDF moved into OCR-required because an
incomplete page was still detected after the employment check. Automated
complete profiles remained at four.

The source original is retained. These aggregate changes and synthetic parity
tests do not claim field-level accuracy; production-provider OCR/readback and
an isolated restore are still required before bulk upload.

# Contact extraction verification: v211

Three changed outputs from the 56 cached OCR texts were compared visually with the original first PDF pages. All three previous lightweight-parser outputs had appended digits from a subsequent address line or an OCR-rendered location icon. The new outputs match the printed phone numbers. This is verification of these three contact facts only, not verification of the full profiles or corpus accuracy.

The shared source-only numeric-date exclusion now covers lightweight upload parsing, full extraction, contact-header extraction, profile rendering and re-extraction. Source matches must not cross newlines. Structured candidate phone values retain their existing treatment; this change does not bulk rewrite stored profiles.

Regressions cover numeric dates, real international and local numbers, adjacent address digits, and profile/re-extraction consistency. Public fixtures are synthetic and contain no candidate source identifiers or contact details.

A complete independently adjudicated gold set remains required for the requested below-1% error claim. No bulk data promotion or launch approval follows from this contact check.

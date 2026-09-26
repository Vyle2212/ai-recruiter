# v174 — separate SAP project dates from employment tenure

The shared canonical parser now accepts `implementation`, `implemented`, and configuration verb forms in explicit SAP project cards. A structured project's directly supplied dates retain precedence over a similarly named project in resume prose. When multiple narrative cards share the same project/client identity, an undated structured record receives no arbitrary range.

Regression coverage uses synthetic two-project, one-employer `Current` employment; distinct clients, roles, date ranges, responsibilities, and source dates remain separate. An explicit project range survives a conflicting same-name narrative card. Existing career tests continue to calculate current tenure through the current month and keep SAP delivery experience separate from overall employment.

Read-only same-population audit against v172: 905 original files, 892 byte-unique, 13 duplicates; valid project rows **558 → 559**, employment rows **1,859 → 1,859**. Four profiles remain automatically complete for validation; 779 need review, 46 need classification review, and four are quality rejected. Observed project gaps remain 251, employment gaps 165, unresolved PDF employment layouts 44, and OCR-required PDFs 15. Zero source failures or database writes. No candidate identifiers, filenames, excerpts, or per-file hashes are included here.

This is one recovered project row, not a completed corpus. At least 78 unique originals remain unavailable relative to the 970-file target. The parser cannot infer an employer, title, project ownership, or date from missing evidence. Bulk upload and production promotion remain gated on a current restore, private Storage/Auth/RLS, OCR, and authenticated exact-artifact readback.

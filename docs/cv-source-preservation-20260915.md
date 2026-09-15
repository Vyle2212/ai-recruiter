# Preserve CV layout through upload and persistence

The text parser returned its cleaned analysis text as rawText, collapsing tabs/replacing bullets. saveCandidate then recursively collapsed all whitespace, and explicitly sanitized rawText again, removing line boundaries before storing raw_text/resume_text. Later source recovery therefore received flattened content.

The parser now analyzes the same cleaned text but returns source text separately with layout-bearing whitespace preserved. Candidate persistence sanitization preserves raw-source aliases (including nested sources), while normalizing ordinary display fields as before. NUL is removed for PostgreSQL compatibility; CRLF/CR become LF, form feed becomes a page-separating newline, and other unsupported controls are cleaned. Repeated sanitization keeps the source layout intact. The existing CV hash still uses its whitespace-normalized representation.

Verification: TXT buffer through parseCv, upload normalization and persistence sanitizer preserves tabs/newlines/bullets, including a second sanitization pass. Display-field cleanup and nested-source handling pass. AI extraction, canonical employment, pinned Search V2 v63 and evidence-boundary tests pass; typecheck passes. This test stops before the database; no live database write was performed.

This fixes source preservation for future saves. It does not recreate layout already discarded in existing rows or guarantee employment completeness. Existing profiles require re-reading their original CVs. Original-file access and live Vercel/Supabase operations remain unavailable here despite confirmed connections. Full population re-extraction and exact deployed-artifact authenticated acceptance remain outstanding; production is not verified.

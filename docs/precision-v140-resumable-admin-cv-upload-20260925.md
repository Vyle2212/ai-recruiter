# Precision v140 — resumable full-collection admin CV upload

## Outcome

The one-time admin re-upload path is now designed for the complete current CV
collection rather than a hand-picked list of the historical 233 unresolved
sources. This is a code-only checkpoint. No Supabase/Vercel production setting,
candidate row, Storage object or search index was changed.

## Ordered full-collection plan

Before the first network request, the browser validates every selected PDF,
DOCX or TXT file and computes a SHA-256 digest locally. Exact byte duplicates
are processed once. The remaining files are committed sequentially from older
to newer source modification time, with selection order as the deterministic
tie-breaker. Candidate writes therefore cannot race each other and allow an
older selected CV to finish after a newer selected CV.

This ordering is an upload-version rule only. It does not infer any employment
or project date from file metadata or CV text. Candidate identity still uses
the deterministic server-side evidence gate; name-only matches remain blocked.

## Interruption and retry safety

The operator can pause after the current CV. A versioned `sessionStorage`
checkpoint records only the collection fingerprint, individual content hashes,
attempt counts and result categories. It never stores CV names, CV text,
contacts, candidate IDs, signed upload tokens or Storage object keys. After a
page refresh in the same browser tab, selecting the same collection restores
terminal outcomes and retries only failures.

Each file is still transferred directly to the private original-CV bucket and
then processed through the existing recruiter-authorized endpoint. Definite
non-SAP files, ambiguous source/OCR failures, identity holds and incomplete SAP
profiles remain separate terminal categories. A source or identity review is
not reported as a successful searchable candidate.

## Operator visibility

The page reports created, updated, already-processed, incomplete-review,
identity-review, source-review, non-SAP rejection and retry-required totals for
the entire selected collection. Rendering is bounded to 250 classified rows so
a 970+ file batch does not require mounting every result while the aggregate
counts remain complete.

## Verification and release state

The deterministic planner regression covers extension and size rejection,
exact-byte deduplication, oldest-to-newest ordering, checkpoint restoration,
PII-free checkpoint serialization and outcome classification. TypeScript,
formatting and existing candidate upload/security regressions remain required
on the exact GitHub head.

Historical extraction evidence is unchanged: the latest code projection is
737/970 sources and 2,160 employment rows, leaving 233 sources that require
their originals to be processed again. This batch does not claim those files
were uploaded or audited.

Production remains `NO_GO`. The production Auth/RLS foundation, private bucket,
schema, readback and live OCR acceptance are still unapplied. Vy must not upload
the 970+ collection until the supervised runtime preflight and a small
synthetic/live acceptance batch pass on the exact promoted artifact.

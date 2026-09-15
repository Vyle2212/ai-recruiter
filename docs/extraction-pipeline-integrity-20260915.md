# Extraction pipeline integrity review

## Verified findings

- `/api/upload-cv` calls deterministic `parseCv` then quality gates and saveCandidate. It does not invoke the AI re-extraction provider. Parser name `parseCandidateAI` is also a deterministic wrapper. Fixing AI re-extraction alone does not repair upload results.
- AI re-extraction prompts silently sliced CV text at 18,000 characters; the alternate prompt builder sliced at 12,000. Of 277 supplied raw-text sources, 42 exceed 18,000 characters and 96 exceed 12,000 (maximum 53,167). These counts describe exposure to truncation, not proof of which missing employment rows it caused.
- JSON responses were normalized without checking completion finish reason or mandatory sections. Empty JSON could become a successful empty extraction.
- Explicit OpenAI selection with missing API key silently selected deterministic fallback, including when noFallbackOnError was requested.

## Implemented

Both prompt builders now include the complete supplied CV text. Input exceeding the chosen model's context must fail visibly; it must never silently lose its tail. Prompt/cache version changed so previous truncated-source results are not reused. Longer requests can cost more and must be measured in the real environment.

Provider rejects non-stop completion, refusals, empty content, invalid JSON and missing/object-invalid top-level sections before normalization/caching. This is response-integrity validation, not a claim of field-level grounding or complete extraction.

Explicit AI selection remains AI when configuration is missing, so the error reaches the existing error/reporting path. With noFallbackOnError it cannot become a fallback run. Missing configuration is not reported as an attempted network request. Default fallback and explicitly allowed fallback-on-error remain supported.

## Verification and unresolved work

New full-source/completion/configuration regression plus existing OpenAI provider and AI extraction tests passed; typecheck passed. Tests exercise CV evidence beyond the old cutoff, cut-off JSON responses, missing sections, refusal, cache version isolation and missing-key no-fallback reporting. No paid AI request, candidate data mutation or production promotion occurred.

Do not wire AI output directly into upload saves until employment/project evidence is validated per record, source coverage is checked and runtime behavior is tested. Existing array normalization in cvExtractionValidator alone does not establish this.

Source recovery status stays 70 profiles / 277 employment records within the 277-source review subset; 207 profiles have no extracted employment. There are 693 additional declared source profiles unavailable for audit. These pipeline changes do not change those deterministic counts.

Live Vercel/Supabase operations are absent from this runtime despite confirmed connections, and OPENAI_API_KEY has not been provisioned here. Full re-extraction, full-population audit and exact-artifact authenticated acceptance remain unverified. User authorization to finish and deploy persists; these are access/capability blockers, not missing permission. Production remains NO_GO under production-trust-release-promotion.md.

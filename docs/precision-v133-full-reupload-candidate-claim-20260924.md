# Precision v133 — full-population CV re-upload and candidate claim

## Outcome

This code batch removes the assumption that an operator must identify and upload the 233 unresolved sources separately. The supported model is to select the complete current collection — 970 files or more — and let the ingestion contract classify every file.

No candidate, CV, contact detail, internal identifier, production database value or Storage object is included here. No Supabase/Vercel production write or configuration change was performed.

## Full re-upload contract

The browser submits CVs in chunks of eight instead of one oversized request. Results are accumulated as new SAP profile, confidently matched update, identity-review hold, non-SAP/JD/unknown rejection, or parser/source failure. The 233 unresolved profiles are not deleted. Re-uploading the complete collection supplies original layout again; the system determines which current records receive new evidence.

This batch also closes the earlier gap where upload success mostly represented identity/SAP scoring. The upload path now runs the deterministic full-profile reader and persists evidence-backed identity/contact, current role, employment history, project history/types, skills, education, certifications and languages. It never manufactures a missing date, employer or project owner.

Every result contains extraction coverage. If the source visibly contains an employment, project, education, certification, skill or language section but no structured value was produced, the result is `SAP_CV_INCOMPLETE_REVIEW`. The row can be retained for repair, but is marked `incomplete_needs_review` and blocked from search/client submission. The batch summary reports this count separately from file failures and identity holds.

## Identity and duplicate safety

Automatic update requires deterministic identity evidence: normalized email, safely normalized phone, canonical profile URL, trusted external ID, exact document hash, or exceptional same-name CV-text overlap. Name alone never updates an existing candidate. The former last-eight-phone and first-near-name update paths are removed. Multiple deterministic matches and probable matches fail closed to identity review.

A future candidate account claim uses the same rule. One exact existing identity is linked through `candidate_accounts`; zero or multiple matches do not create ownership. The prepared RPC checks `auth.uid()`, active candidate role, normalized email and match cardinality, uses an empty `search_path`, and is not callable by `anon`. It has not been installed.

## Field precedence and later candidate updates

Profile-version merging preserves candidate-confirmed and recruiter-approved fields from a later admin upload. A candidate CV can update candidate-owned and parser-owned fields on the same canonical profile. Conflicts stay reviewable instead of silently replacing a trusted value.

## Search and client-offer gates

Parser output is draft evidence, not automatic truth. Both admin and candidate profiles are hidden when required profile data is incomplete. Candidate-owned profiles additionally require candidate confirmation. A complete admin-uploaded profile does not need to wait for candidate signup, but client submission is blocked unless it has valid name, internal contactability, location, current title/employer, complete employment dates, SAP project history, education, languages, skills, an SAP module, and no unresolved identity/duplicate/re-upload blocker.

The candidate self-confirm screen already exists and now presents the same canonical profile used by admin/recruiter/client search. It shows exact missing requirements and lets the candidate review identity/contact, current role, complete employment, SAP projects, modules/skills, education, certifications, languages, salary and availability. Employer remains separate from project/client. Final submission stays disabled until authenticated ownership, reviewed schema/RLS and runtime acceptance are proven.

The prepared schema/readback pair adds structured certification/project storage and extraction-coverage provenance. It is manual and has not been run on production.

## Verification and blockers

The full-reupload lifecycle, identity/completion/non-SAP, extraction-section coverage, structured candidate confirmation, search-quality and Validation Queue regressions pass locally. TypeScript validation also passes. The local production build cannot be used as evidence because this workspace links `node_modules` from outside Turbopack's filesystem root; the exact-head GitHub build and CI remain required after the batch commit.

Production remains `NO_GO`. The original-CV bucket, lifecycle columns, claim RPC and security cutover have not been executed. The 970+ originals have not run through the new flow. Candidate claim/submission, full readback, live OCR and authenticated role acceptance remain required. A fresh full-population audit will supersede the historical 533 additive, 108 conflict and 233 unresolved queues; they are not deleted.

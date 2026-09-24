# Precision v138 — search lifecycle invalidation (2026-09-24)

## Outcome

This batch closes stale-search paths after a candidate-owned CV update. It is
code-only: no SQL was installed, no runtime flag was enabled and no production
data was read or written.

- One lifecycle policy now blocks `needs_review`, `non_sap`, `rejected_noise`,
  deleted, hidden and archived candidate records from normal discovery.
- Search V2 re-reads current candidate status outside its 15-minute projection
  cache. The lifecycle revision participates in the ranked-result cache key, so
  a stale snapshot cannot keep a newly blocked candidate visible.
- Request-supplied Search V2 documents go through the same current-state gate;
  they cannot bypass it by disabling dataset caching.
- Legacy keyword search, vector search, current match generation, persisted
  match reads, candidate lists and shortlist/match writes all enforce the same
  lifecycle decision.
- Explicit recruiter review mode may inspect `needs_review`; terminal and
  non-SAP records remain blocked even in review mode.
- The candidate-owned database transaction from v137 still deletes the stale
  `candidate_search_index` row atomically. This batch adds defense in depth at
  every response or mutation boundary that can expose an indexed candidate.

## Covered surfaces

- `/api/recruiter/search-v2`
- `/api/search-candidates`
- `/api/vector-search`
- `/api/candidates` and `/api/get-candidates`
- `/api/generate-matches`, `/api/matches`, `/api/match-candidates` and
  `/api/matches/[jobId]`
- `/api/get-matches`, `/api/ai-match` and `/api/shortlisted`
- search-index rebuild audit

`scripts/candidateSearchLifecycleConsistency.test.ts` verifies the lifecycle
matrix and requires every surface above to retain the shared gate. The
Production Trust workflow runs this regression.

## Remaining gates

Production remains **NO_GO**. The candidate portal still needs an authenticated,
owner-bound required-field confirmation transaction that changes
`claimed_incomplete` / `needs_review` to the reviewed searchable state only
after every required field and accuracy consent passes. The production Auth
foundation, complete forced-RLS cutover/readback, private Storage, live OCR and
full 970+ source audit also remain unexecuted.

The private CV set was not available in this GitHub-only run. Population counts
therefore remain 737/970 sources with structured employment and 233 requiring
original-CV reprocessing. No candidate identifier, CV text or contact data is
stored in this checkpoint.

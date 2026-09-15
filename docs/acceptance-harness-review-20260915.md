# Acceptance harness review after run 12

Scope: isolated Acceptance branch and synthetic dataset. No production verification or real-profile population audit is claimed.

## Confirmed findings and changes

- Run 12 returned 503 before profile deactivation. Its old assertion discarded the response body, so the underlying 503 is not established. All three positive lifecycle readiness checks now use the existing bounded helper. Only explicitly identified SEARCH_INDEX_WARMING cold/warming responses retry; unknown 503, authorization errors and failed readiness stop immediately.
- Playwright results contain nested suites. The report previously ignored nested specs, producing testCount 0. Recursive collection now preserves passed, failed and skipped outcomes.
- Final report requires 16 distinct test names and valid scoped skips. NO_GO now produces a failing exit code after writing evidence.
- Serial mode skipped every later test after a failure. Default sequential execution with one worker now collects independent failures. Candidate-detail tests use the fixed synthetic ID rather than a value populated by an earlier test. Account reactivation remains in finally; workflow cleanup remains always-run and run-scoped.
- In-process cache reuse cannot be assumed across separate serverless requests. Deterministic cache tests enforce same-scope reuse and cross-scope misses. Deployed tests retain manager isolation and additionally enforce private/no-store and denied anonymous/client detail access.
- Allowed permission checks now require HTTP 200, instead of merely not 403.
- Screenshot upload path now matches artifacts/acceptance-evidence. Report/upload steps require installed dependencies, avoiding missing-tsx noise on early setup failures.

## Verification

Passed: new readiness tests (warming then ready; 401/403/500/unknown503 never retried); nested report tests; full report invocation with complete synthetic results, failing results and missing results; workflow contracts; lease contracts; canonical fixture/name lookup; environment safety; deployment bridge; cache privacy; TypeScript; production build (138 pages, five existing filesystem tracing warnings). Playwright discovery finds all 16 tests; discovery is not browser execution.

## Still required

Authenticated deployment run on the exact new SHA; inspect every result and final evidence. Real Internal Talent Hub profiles A8CCB8, Gunawan Lie and Indra Permana, population audit and score distributions remain unverified. External-provider tests remain deliberately excluded from internal-only Acceptance.

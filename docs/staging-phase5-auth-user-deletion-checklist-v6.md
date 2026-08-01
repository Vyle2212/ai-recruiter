# Phase 5 V6 Staging Auth-User Deletion Checklist

Auth deletion is a separate approved Auth-administration operation after public
fixture cleanup. The SQL cleanup artifacts never delete Auth users.

## Entry gate

- [ ] Cleanup approval explicitly covers all eight test Auth users.
- [ ] Runtime testing is closed.
- [ ] Every client signed out.
- [ ] Every test session invalidated.
- [ ] No harness process remains active.
- [ ] Normal or partial public cleanup committed successfully.
- [ ] Read-only post-cleanup verification returned `post_cleanup_valid = true`.
- [ ] Private Auth ledger contains exactly eight IDs and eight logical references.
- [ ] Existing-owner overlap is zero.
- [ ] Production remains blocked.

## Exact deletion

Delete exactly the eight configured test users by private Auth ID, cross-checked
against the approved non-sensitive metadata reference:

- [ ] no-profile;
- [ ] invited client;
- [ ] inactive candidate;
- [ ] synthetic admin;
- [ ] recruiter manager;
- [ ] recruiter;
- [ ] client;
- [ ] candidate.

Do not target by email, prefix, partial metadata, normalized email or approximate
search. Do not print IDs or emails.

## Counts-only reconciliation

```text
Configured logical references expected: 8
Configured logical references remaining: 0
Configured Auth IDs expected: 8
Configured Auth IDs remaining: 0
Existing owner present: YES
Unexpected deletion count: 0
Auth cleanup valid: YES / NO
Operator:
Reviewer:
```

## Stop conditions

Stop before deletion if the private ledger is incomplete, a session remains
active, public cleanup or verification has not passed, owner overlap is nonzero,
or any selected target cannot be matched exactly.

Stop after any deletion-count mismatch. Do not invoke Phase 4 rollback.

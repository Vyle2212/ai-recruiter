# Phase 5 V6 Staging Auth-User Creation Checklist

Preparation and operator checklist only. It does **not** authorize execution.

## Required approvals

All four written approvals must exist before the first test user or public
fixture is created:

1. Phase 5 V6 plan execution.
2. Creation of exactly eight test Auth users.
3. Synthetic public writes and controlled runtime mutations.
4. Cleanup, including deletion of exactly eight test Auth users.

Phase 4 rollback remains unauthorized. Production remains blocked.

## Environment gate

- [ ] Dedicated `ai-recruiter-staging` independently confirmed.
- [ ] Production target and credentials are absent.
- [ ] Application `.env.local` is not used.
- [ ] Post-Phase-4 checkpoint reference, size, SHA-256 and inventory verified.
- [ ] V6 artifact fingerprints verified.
- [ ] Normal and partial-recovery cleanup artifacts reviewed before setup.
- [ ] No identifier, email, password, URL, key, JWT or session will appear in evidence.
- [ ] Existing owner modification is prohibited.

## Exact private inventory

Create one user for each private logical identity:

1. no-profile authenticated user;
2. invited client;
3. inactive candidate;
4. active synthetic admin;
5. active recruiter manager;
6. active recruiter;
7. active client;
8. active candidate.

For each user:

- [ ] Use a unique private valid email.
- [ ] Use a unique private password stored only in the restricted operator worksheet.
- [ ] Record the Auth ID privately.
- [ ] Store the approved non-sensitive logical reference in user metadata.
- [ ] Confirm the user is not the existing staging owner.
- [ ] Confirm no public profile was created automatically.
- [ ] Do not print or screenshot user details.

## Reconciliation before public setup

- [ ] Exactly eight configured Auth IDs exist.
- [ ] Exactly eight approved metadata references exist.
- [ ] Auth IDs are unique.
- [ ] Normalized emails are unique.
- [ ] Existing-owner overlap count is zero.
- [ ] All eight users have zero public profiles.
- [ ] Private fixture configuration was prepared in memory.
- [ ] Fixture Base64 was not saved inside the repository.
- [ ] Passwords, URL and anon key are absent from fixture configuration.
- [ ] Clipboard was cleared after SQL rendering.

Record counts only:

```text
Expected test Auth users: 8
Actual test Auth users: <count>
Duplicate logical references: <count>
Existing-owner overlap: <count>
Unexpected public profiles: <count>
Creation gate: PASS / FAIL
Operator:
Reviewer:
```

## Stop conditions

Stop before setup when any approval is missing, staging isolation is uncertain,
a duplicate or owner overlap exists, an Auth trigger creates a public row,
private values appear in output, or the count differs from eight.

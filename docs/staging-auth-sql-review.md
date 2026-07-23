# Staging Auth SQL Review

Read-only review package. It contains no credentials or project identifiers and authorizes no mutation.

## Review history

- V1: rejected.
- V2: rejected.
- V3: read-only preflight passed; mutation chain rejected.
- V4: complete chain rejected because `bootstrap_reference` was ambiguous in the bootstrap and bootstrap rollback.
- V5: composite chain pending manual review.

V3 safe evidence: `STG-PREFLIGHT-V3-20260723-01`. The V3 preflight ran as `postgres` on 2026-07-23, returned no rows, used a read-only transaction, rolled back, and caused no database, candidate, or production mutation.

## V4 review result

V4 fingerprints matched. Its preflight, schema, helpers, and RLS were statically reviewable. The complete chain was rejected because a PL/pgSQL local variable named `bootstrap_reference` conflicted with `staging_auth_bootstrap_provenance.bootstrap_reference` in both bootstrap directions. V4 remains preserved and unexecuted.

## V5 minimal correction

V5 introduces only:

- `supabase/bootstrap/202607230019_staging_initial_owner_bootstrap_v5.sql` - `8182a28057d5c3276e3a23443c03159c141511ea6df2b5c8a858527e08886b1d`
- `supabase/rollback/202607230019_staging_initial_owner_bootstrap_rollback_v5.sql` - `6caf8e9645ecf624043d1602e9daf5fb7eaaf1ca22ed97aa0b150c0b3d0a0468`

Both use the distinct local name `v_bootstrap_reference`. Provenance columns use explicit aliases, including `p.bootstrap_reference = v_bootstrap_reference`. No unqualified `btrim(bootstrap_reference)` expression remains. Exact placeholders, Auth/profile email consistency, advisory locking, immutable provenance, dependency checks, and exact three-row insert/delete assertions are retained.

## V5 composite authoritative chain

Execution order:

1. V4 preflight `202607230014` - `181a500cb170606165048690059d09ef467db8687a46a439169ec2288da31e09`
2. V4 schema `202607230015` - `a30351a050111fadb7f6939700c543a1bf53ae179568cf200d69e79bd266a6fb`
3. V4 helpers `202607230016` - `1b1d8f9393900d57972d97efddfe71fca4447fd238444b92433e1d9c98980105`
4. V5 bootstrap `202607230019` - `8182a28057d5c3276e3a23443c03159c141511ea6df2b5c8a858527e08886b1d`
5. V4 RLS `202607230018` - `e61484fef2c633c7c146cb3b5c7a74584b700526156b191049288d98ea005a45`

Rollback order:

1. V4 RLS rollback `202607230018` - `6f83411e7abe88c88968ead29d56d656e1814ffcd09fb67fb6b4858710e7e352`
2. V5 bootstrap rollback `202607230019` - `6caf8e9645ecf624043d1602e9daf5fb7eaaf1ca22ed97aa0b150c0b3d0a0468`
3. V4 helpers rollback `202607230016` - `97b786ab8286fb69d083a2a4a342e8607f7a76f20ae39e7932a4dc7cd6692442`
4. V4 schema rollback `202607230015` - `431b9453f7d731549d989d4de7df373dfbedf1355dcb487af7113d705555f903`

The reused V4 core fingerprints are unchanged. Any later content change requires a new fingerprint and review.

## Preserved controls and remaining validation

The composite retains strict one-shot creation, constrained roles/statuses, no privileged default, ownership-shape checks, explicit foreign-key deletion, invitation safeguards, immutable audit guards, fixed helper search paths, minimum grants, deny-by-default FORCE RLS, zero DELETE policies, zero guest policies, and candidate/production isolation.

FORCE RLS owner behavior, policy recursion, runtime grants, identity denial, protected updates, tenant isolation, bootstrap behavior, and rollback behavior still require controlled real staging validation. A staging backup and explicit owner approval remain mandatory before any mutation.

- [ ] V5 fingerprints reviewed
- [ ] V5 composite chain reviewed
- [ ] V5 bootstrap reviewed
- [ ] V5 bootstrap rollback reviewed
- [ ] Backup confirmed
- [ ] Explicit staging mutation approval recorded externally

**V3 READ-ONLY PREFLIGHT PASSED**
**V4 CHAIN REJECTED**
**V5 PENDING MANUAL REVIEW**
**SQL NOT EXECUTED**
**MIGRATIONS NOT EXECUTED**
**BOOTSTRAP NOT EXECUTED**
**RLS NOT EXECUTED**
**ROLLBACK NOT EXECUTED**
**PRODUCTION BLOCKED**
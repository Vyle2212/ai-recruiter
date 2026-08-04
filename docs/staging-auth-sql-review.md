# Staging Auth SQL Review

## CURRENT AUTHORITATIVE STAGING CHAIN

This is the only current executable artifact chain. Every later V1-V7 chain
section in this document is historical and must not be executed.

Completed:

1. V4 read-only preflight
2. V4 schema
3. V4 helpers
4. V6 privilege correction

Current pending phase:

5. V8 bootstrap — `supabase/bootstrap/202607230022_staging_initial_owner_bootstrap_v8.sql`

Not authorized:

6. V4 RLS

Current rollback order:

1. V4 RLS rollback — only after RLS is applied
2. V8 bootstrap rollback — `supabase/rollback/202607230022_staging_initial_owner_bootstrap_rollback_v8.sql`
3. V6 safe privilege rollback
4. V4 helpers rollback
5. V4 schema rollback

**V5 REJECTED**
**V7 REJECTED**
**V8 PENDING MANUAL REVIEW**
**V8 BOOTSTRAP NOT EXECUTED**
**V8 ROLLBACK NOT EXECUTED**
**RLS NOT EXECUTED**
**PRODUCTION BLOCKED**

V8 uses one Base64-encoded UTF-8 JSON configuration token. Its fixed
fingerprints are documented in the private preparation helper below. Manual
review, private preflight, backup confirmation, and explicit approval remain
mandatory. This document does not authorize execution.

Read-only review package. It contains no credentials or project identifiers and authorizes no mutation.

## Review history

- V1: rejected.
- V2: rejected.
- V3: read-only preflight passed; mutation chain rejected.
- V4: complete chain rejected because `bootstrap_reference` was ambiguous in the bootstrap and bootstrap rollback.
- V5: rejected after two safe failed substitution attempts.
- V7: rejected after manual static review.
- V8: pending manual review; not executed.

V3 safe evidence: `STG-PREFLIGHT-V3-20260723-01`. The V3 preflight ran as `postgres` on 2026-07-23, returned no rows, used a read-only transaction, rolled back, and caused no database, candidate, or production mutation.

## V4 review result

V4 fingerprints matched. Its preflight, schema, helpers, and RLS were statically reviewable. The complete chain was rejected because a PL/pgSQL local variable named `bootstrap_reference` conflicted with `staging_auth_bootstrap_provenance.bootstrap_reference` in both bootstrap directions. V4 remains preserved and unexecuted.

## V5 minimal correction

V5 introduces only:

- `supabase/bootstrap/202607230019_staging_initial_owner_bootstrap_v5.sql` - `8182a28057d5c3276e3a23443c03159c141511ea6df2b5c8a858527e08886b1d`
- `supabase/rollback/202607230019_staging_initial_owner_bootstrap_rollback_v5.sql` - `6caf8e9645ecf624043d1602e9daf5fb7eaaf1ca22ed97aa0b150c0b3d0a0468`

Both use the distinct local name `v_bootstrap_reference`. Provenance columns use explicit aliases, including `p.bootstrap_reference = v_bootstrap_reference`. No unqualified `btrim(bootstrap_reference)` expression remains. Exact placeholders, Auth/profile email consistency, advisory locking, immutable provenance, dependency checks, and exact three-row insert/delete assertions are retained.

## HISTORICAL — DO NOT EXECUTE — V5 composite chain

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

## HISTORICAL — DO NOT EXECUTE — V7 initial-owner bootstrap patch

The earlier V5 status above is superseded by this record.

- Phase 1 schema: completed
- Phase 2 helpers: completed
- V6 privilege repair: completed
- V5 bootstrap execution attempt 1: safely failed; `staging_owner_v5_placeholder_not_replaced`; no rows created
- V5 bootstrap execution attempt 2: safely failed; `staging_owner_v5_placeholder_not_replaced`; no rows created
- Failure reason: substitution/sentinel collision
- V5 status: rejected
- V7 status: pending manual review
- V7 bootstrap executed: no
- V7 rollback executed: no
- RLS: not executed
- Candidate-domain modified: no
- Production modified: no
- Production: blocked

V5 is preserved unchanged. Each of its seven placeholders occurs twice in both
directions: once in an assignment and once in a validation comparison. Global
replacement changes the validation sentinel as well as the assignment, making
the guard compare each populated value with itself. This explains both safe
`staging_owner_v5_placeholder_not_replaced` failures before insertion.

V7 uses a single `__STAGING_BOOTSTRAP_CONFIG_JSON__` token. The SQL sentinel is
assembled from two immutable string fragments, so deterministic replacement of
the one token cannot modify the comparison value. The JSON must contain exactly
the seven documented string fields; malformed JSON, missing or extra fields,
blank values, and invalid UUIDs fail with fixed non-sensitive errors. Raw JSON
is held only in transaction-local PL/pgSQL variables and is never persisted.

Artifacts pending manual review:

- Bootstrap: `supabase/bootstrap/202607230021_staging_initial_owner_bootstrap_v7.sql`
  - SHA-256: `2915afc31882bd5ebae3df54cb03f7eeeca351ce73a1a4f201f7fa3c9335ab2e`
- Rollback: `supabase/rollback/202607230021_staging_initial_owner_bootstrap_rollback_v7.sql`
  - SHA-256: `afbfd440dab7ed02aab909b145594f81906946fa9f0e74a2ddbcfd08336dcca0`

## CURRENT V8 PRIVATE PREPARATION HELPER

Run only from the clean repository root after manual review and authorization.
The caller selects `Bootstrap` or `Rollback`; artifact paths and approved hashes
are internal and cannot be supplied by the caller. The helper prompts privately
for the seven values, encodes compact UTF-8 JSON as Base64, never writes
populated SQL to disk, and never prints private data or populated SQL.

```powershell
function Copy-StagingBootstrapV8Sql {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("Bootstrap", "Rollback")]
        [string] $Mode
    )

    $approved = @{
        Bootstrap = @{
            Path = '.\supabase\bootstrap\202607230022_staging_initial_owner_bootstrap_v8.sql'
            Sha256 = '61fbe659d76471f33bcf0f6e0cf55b288e7511d8e034d23d87f8b3d42b0418d9'
        }
        Rollback = @{
            Path = '.\supabase\rollback\202607230022_staging_initial_owner_bootstrap_rollback_v8.sql'
            Sha256 = '9cb8606cbb3e190d3f0602652e4ed23c9619804fd7b294a53922d22fafb69ce9'
        }
    }
    $token = '__STAGING_BOOTSTRAP_CONFIG_B64__'
    $selected = $approved[$Mode]

    $gitState = git status --porcelain --untracked-files=all 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to verify Git working tree.' }
    if ($gitState) { throw 'Git working tree is not clean.' }
    if (-not (Test-Path -LiteralPath $selected.Path -PathType Leaf)) {
        throw 'Approved V8 artifact is missing.'
    }
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $selected.Path).Hash
    if ($actualHash -ine $selected.Sha256) { throw 'Approved V8 artifact fingerprint mismatch.' }

    $sql = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $selected.Path))
    $beforeCount = ([regex]::Matches($sql, [regex]::Escape($token))).Count
    if ($beforeCount -ne 1) { throw 'V8 config placeholder count is not exactly one.' }

    $config = [ordered]@{
        provenance_id = Read-Host 'Provenance UUID'
        organization_id = Read-Host 'Organization UUID'
        organization_name = Read-Host 'Organization name'
        auth_user_id = Read-Host 'Existing staging Auth-user UUID'
        admin_profile_id = Read-Host 'Admin profile UUID'
        admin_email = Read-Host 'Existing staging Auth-user email'
        bootstrap_reference = Read-Host 'Bootstrap reference'
    }
    $json = $config | ConvertTo-Json -Compress
    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $configB64 = [System.Convert]::ToBase64String($jsonBytes)
    $populatedSql = $sql.Replace($token, $configB64)

    $afterCount = ([regex]::Matches($populatedSql, [regex]::Escape($token))).Count
    if ($afterCount -ne 0) { throw 'V8 config placeholder remains after substitution.' }
    if ($populatedSql -notmatch '(?im)^\s*begin\s*;' -or
        $populatedSql -notmatch '(?im)^\s*commit\s*;') {
        throw 'V8 transaction boundary missing.'
    }
    if ($populatedSql -match 'ConvertTo-Json|Read-Host|Set-Clipboard|Copy-StagingBootstrapV8Sql') {
        throw 'PowerShell source marker detected in populated SQL.'
    }

    Set-Clipboard -Value $populatedSql
    Remove-Variable config, json, jsonBytes, configB64, populatedSql -ErrorAction SilentlyContinue
    Write-Output 'Approved V8 fingerprint and structure verified; populated SQL copied to clipboard.'
}
```

The success message contains no UUID, email, JSON, Base64 configuration, or
SQL. Clear the clipboard immediately after separately approved manual use. This
helper grants no authorization.
## HISTORICAL — DO NOT EXECUTE — V6 function privilege correction

Real staging Phase 1 schema execution completed and passed verification. Real staging Phase 2 V4 helper execution also completed: nine functions and eight triggers were structurally correct, all seven tables remained empty, policies and RLS remained absent, and missing-profile behavior passed. Privilege verification failed because `authenticated` and `anon` could execute all nine functions despite PUBLIC being denied.

V6 is pending manual review and has not executed:

- `supabase/migrations/202607230020_staging_auth_function_privileges_v6.sql` - `e9e7894363319f981476d69f956c1062a29c9d92e1fff7238d5bfc4c1f39c752`
- `supabase/rollback/202607230020_staging_auth_function_privileges_rollback_v6.sql` - `9fb6d6f23d83f24bff85146add90411ba7d1be730a018a32eaedbb0afcd87d34`

The patch first revokes EXECUTE on all nine functions from PUBLIC, `anon`, `authenticated`, and `service_role`. It then grants only `authenticated` access to the six `current_user_*` identity helpers. The three trigger-only functions receive no application-role grant. No function body, trigger, table, policy, RLS state, bootstrap row, or data is changed.

The safe V6 rollback intentionally does not restore the observed insecure grants. It removes the six V6 authenticated grants and leaves all nine functions denied to PUBLIC, `anon`, `authenticated`, and `service_role`. Restoring the insecure state is prohibited.

No `ALTER DEFAULT PRIVILEGES` statement is included. Future public-schema functions may receive platform defaults and require explicit privilege review. Any broader default-function privilege hardening requires a separate artifact and approval.

### HISTORICAL — DO NOT EXECUTE — V6 composite chain

Execution order:

1. V4 preflight
2. V4 schema - completed and verified
3. V4 helpers - completed; structure passed, privilege verification failed
4. V6 function privilege correction - pending manual review
5. V5 bootstrap - blocked
6. V4 RLS - blocked

Rollback order:

1. V4 RLS rollback
2. V5 bootstrap rollback
3. V6 safe privilege rollback
4. V4 helpers rollback
5. V4 schema rollback

FORCE RLS behavior still requires real staging validation after privilege correction, bootstrap, and RLS approval. Production remains blocked.

**V4 HELPER EXECUTION COMPLETED**
**V4 HELPER STRUCTURAL VERIFICATION PASSED**
**V4 HELPER PRIVILEGE VERIFICATION FAILED**
**V6 PRIVILEGE PATCH PENDING MANUAL REVIEW**
**V6 PRIVILEGE CORRECTION NOT EXECUTED**
**BOOTSTRAP BLOCKED**
**RLS BLOCKED**
**PRODUCTION BLOCKED**

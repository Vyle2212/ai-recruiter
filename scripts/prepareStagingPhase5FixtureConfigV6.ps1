[CmdletBinding()]
param(
    [ValidateSet('Clipboard','None')]
    [string] $OutputMode = 'Clipboard'
)

$ErrorActionPreference = 'Stop'

function Read-PrivateText {
    param([Parameter(Mandatory)][string] $Prompt)
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        $secure.Dispose()
    }
}

function Assert-PrivateUuid {
    param([Parameter(Mandatory)][string] $Value,[Parameter(Mandatory)][string] $Code)
    $parsed = [Guid]::Empty
    if (-not [Guid]::TryParse($Value,[ref]$parsed) -or $parsed -eq [Guid]::Empty) {
        throw $Code
    }
    return $parsed
}

function Assert-PrivateEmail {
    param([Parameter(Mandatory)][string] $Value)
    $normalized = $Value.Trim().ToLowerInvariant()
    if ($normalized -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
        throw 'phase5_v6_email_invalid'
    }
    return $normalized
}

function ConvertTo-UuidV5 {
    param(
        [Parameter(Mandatory)][Guid] $Namespace,
        [Parameter(Mandatory)][string] $Name
    )
    $ns = $Namespace.ToByteArray()
    [Array]::Reverse($ns,0,4)
    [Array]::Reverse($ns,4,2)
    [Array]::Reverse($ns,6,2)
    $nameBytes = [Text.Encoding]::UTF8.GetBytes($Name)
    $all = New-Object byte[] ($ns.Length + $nameBytes.Length)
    [Array]::Copy($ns,0,$all,0,$ns.Length)
    [Array]::Copy($nameBytes,0,$all,$ns.Length,$nameBytes.Length)
    $sha1 = [Security.Cryptography.SHA1]::Create()
    try { $hash = $sha1.ComputeHash($all) } finally { $sha1.Dispose() }
    $uuidBytes = [byte[]]$hash[0..15]
    $uuidBytes[6] = ($uuidBytes[6] -band 0x0f) -bor 0x50
    $uuidBytes[8] = ($uuidBytes[8] -band 0x3f) -bor 0x80
    [Array]::Reverse($uuidBytes,0,4)
    [Array]::Reverse($uuidBytes,4,2)
    [Array]::Reverse($uuidBytes,6,2)
    return [Guid]::new($uuidBytes)
}

function New-IdFactory {
    param([Guid]$Namespace,[string]$Batch)

    $converter = (
        Get-Command ConvertTo-UuidV5 -CommandType Function
    ).ScriptBlock

    return {
        param([string]$Label)

        $generated = & $converter `
            -Namespace $Namespace `
            -Name "$Batch::$Label"

        $generated.ToString()
    }.GetNewClosure()
}
function Assert-NoForbiddenConfigKeys {
    param([object]$Object)
    $forbidden = '(?i)(password|secret|token|jwt|url|connection|string|api.?key|anon.?key|private.?key)'
    function Visit([object]$Value,[string]$Path) {
        if ($null -eq $Value) { return }
        if ($Value -is [Collections.IDictionary]) {
            foreach ($key in $Value.Keys) {
                if ([string]$key -match $forbidden) { throw 'phase5_v6_forbidden_config_key' }
                Visit $Value[$key] "$Path.$key"
            }
            return
        }
        if ($Value -is [Collections.IEnumerable] -and $Value -isnot [string]) {
            $index = 0
            foreach ($item in $Value) { Visit $item "$Path[$index]"; $index++ }
        }
    }
    Visit $Object '$'
}

$config = $null
$json = $null
$configB64 = $null
$privateValues = [Collections.Generic.List[string]]::new()

try {
    $batch = Read-Host 'Non-sensitive Phase 5 V6 batch reference'
    if ([string]::IsNullOrWhiteSpace($batch) -or $batch.Length -gt 96) {
        throw 'phase5_v6_batch_invalid'
    }
    $batch = $batch.Trim()
    if ($batch -notmatch '^RLSV4-P5-V6-[A-Za-z0-9._-]+$') {
        throw 'phase5_v6_batch_reference_invalid'
    }

    $foundation = [ordered]@{
        organization_id = (Assert-PrivateUuid (Read-PrivateText 'Existing foundation organization UUID') 'phase5_v6_foundation_uuid_invalid').ToString()
        profile_id = (Assert-PrivateUuid (Read-PrivateText 'Existing foundation profile UUID') 'phase5_v6_foundation_uuid_invalid').ToString()
        auth_user_id = (Assert-PrivateUuid (Read-PrivateText 'Existing owner Auth-user UUID') 'phase5_v6_foundation_uuid_invalid').ToString()
        provenance_id = (Assert-PrivateUuid (Read-PrivateText 'Existing provenance UUID') 'phase5_v6_foundation_uuid_invalid').ToString()
    }
    foreach ($v in $foundation.Values) { [void]$privateValues.Add([string]$v) }
    if (($foundation.Values | Sort-Object -Unique).Count -ne 4) {
        throw 'phase5_v6_foundation_uuid_duplicate'
    }

    $namespace = [Guid]$foundation.provenance_id
    $newId = New-IdFactory -Namespace $namespace -Batch $batch

    $identitySpecs = [ordered]@{
        no_profile = @{ expected_state='no_profile'; profile_reference=$null }
        invited_client = @{ expected_state='invited'; profile_reference='RLSV4-P5-V6-PROFILE-INVITED-CLIENT' }
        inactive_candidate = @{ expected_state='inactive'; profile_reference='RLSV4-P5-V6-PROFILE-INACTIVE-CANDIDATE' }
        active_admin = @{ expected_state='active'; profile_reference='RLSV4-P5-V6-PROFILE-ACTIVE-ADMIN' }
        active_recruiter_manager = @{ expected_state='active'; profile_reference='RLSV4-P5-V6-PROFILE-ACTIVE-RM' }
        active_recruiter = @{ expected_state='active'; profile_reference='RLSV4-P5-V6-PROFILE-ACTIVE-RECRUITER' }
        active_client = @{ expected_state='active'; profile_reference='RLSV4-P5-V6-PROFILE-ACTIVE-CLIENT' }
        active_candidate = @{ expected_state='active'; profile_reference='RLSV4-P5-V6-PROFILE-ACTIVE-CANDIDATE' }
    }

    $authUsers = [ordered]@{}
    foreach ($key in $identitySpecs.Keys) {
        $authId = (Assert-PrivateUuid (Read-PrivateText "Auth-user UUID for $key") 'phase5_v6_auth_uuid_invalid').ToString()
        $email = Assert-PrivateEmail (Read-PrivateText "Valid test email for $key")
        [void]$privateValues.Add($authId)
        [void]$privateValues.Add($email)
        $authUsers[$key] = [ordered]@{
            logical_reference = "RLSV4-P5-V6-AUTH-$($key.ToUpperInvariant())"
            auth_user_id = $authId
            email = $email
            expected_state = $identitySpecs[$key].expected_state
            profile_reference = $identitySpecs[$key].profile_reference
        }
    }
    if (($authUsers.Values.auth_user_id | Sort-Object -Unique).Count -ne 8) {
        throw 'phase5_v6_auth_uuid_duplicate'
    }
    if (($authUsers.Values.email | Sort-Object -Unique).Count -ne 8) {
        throw 'phase5_v6_auth_email_duplicate'
    }
    if ($authUsers.Values.auth_user_id -contains $foundation.auth_user_id) {
        throw 'phase5_v6_owner_auth_overlap'
    }

    $orgInternalA = & $newId 'org-internal-a'
    $orgClientA = & $newId 'org-client-a'
    $orgClientB = & $newId 'org-client-b'
    $orgInternalB = & $newId 'org-internal-b'
    $clientA = & $newId 'opaque-client-a'
    $clientB = & $newId 'opaque-client-b'
    $candidateA = & $newId 'opaque-candidate-a'
    $candidateB = & $newId 'opaque-candidate-b'

    $profileInvited = & $newId 'profile-invited-client'
    $profileAdmin = & $newId 'profile-active-admin'
    $profileRm = & $newId 'profile-active-rm'
    $profileRecruiter = & $newId 'profile-active-recruiter'
    $profileClient = & $newId 'profile-active-client'
    $profileCandidate = & $newId 'profile-active-candidate'
    $profileInactiveCandidate = & $newId 'profile-inactive-candidate'

    $setup = [ordered]@{
        organizations = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-ORG-INTERNAL-A'; creation_stage='setup'; id=$orgInternalA; name='RLSV4-P5-V6-ORG-INTERNAL-A'; organization_type='internal'; status='active' },
            [ordered]@{ logical_reference='RLSV4-P5-V6-ORG-CLIENT-A'; creation_stage='setup'; id=$orgClientA; name='RLSV4-P5-V6-ORG-CLIENT-A'; organization_type='client'; status='active' },
            [ordered]@{ logical_reference='RLSV4-P5-V6-ORG-CLIENT-B'; creation_stage='setup'; id=$orgClientB; name='RLSV4-P5-V6-ORG-CLIENT-B'; organization_type='client'; status='active' }
        )
        profiles = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-PROFILE-INVITED-CLIENT'; creation_stage='setup'; id=$profileInvited; auth_user_id=$authUsers.invited_client.auth_user_id; email=$authUsers.invited_client.email; full_name='RLSV4-P5-V6-PROFILE-INVITED-CLIENT'; role='client'; status='invited'; organization_id=$orgClientB; client_id=$clientB; candidate_id=$null },
            [ordered]@{ logical_reference='RLSV4-P5-V6-PROFILE-ACTIVE-ADMIN'; creation_stage='setup'; id=$profileAdmin; auth_user_id=$authUsers.active_admin.auth_user_id; email=$authUsers.active_admin.email; full_name='RLSV4-P5-V6-PROFILE-ACTIVE-ADMIN'; role='admin'; status='active'; organization_id=$orgInternalA; client_id=$null; candidate_id=$null },
            [ordered]@{ logical_reference='RLSV4-P5-V6-PROFILE-ACTIVE-RM'; creation_stage='setup'; id=$profileRm; auth_user_id=$authUsers.active_recruiter_manager.auth_user_id; email=$authUsers.active_recruiter_manager.email; full_name='RLSV4-P5-V6-PROFILE-ACTIVE-RM'; role='recruiter_manager'; status='active'; organization_id=$orgInternalA; client_id=$null; candidate_id=$null },
            [ordered]@{ logical_reference='RLSV4-P5-V6-PROFILE-ACTIVE-RECRUITER'; creation_stage='setup'; id=$profileRecruiter; auth_user_id=$authUsers.active_recruiter.auth_user_id; email=$authUsers.active_recruiter.email; full_name='RLSV4-P5-V6-PROFILE-ACTIVE-RECRUITER'; role='recruiter'; status='active'; organization_id=$orgInternalA; client_id=$null; candidate_id=$null },
            [ordered]@{ logical_reference='RLSV4-P5-V6-PROFILE-ACTIVE-CLIENT'; creation_stage='setup'; id=$profileClient; auth_user_id=$authUsers.active_client.auth_user_id; email=$authUsers.active_client.email; full_name='RLSV4-P5-V6-PROFILE-ACTIVE-CLIENT'; role='client'; status='active'; organization_id=$orgClientA; client_id=$clientA; candidate_id=$null },
            [ordered]@{ logical_reference='RLSV4-P5-V6-PROFILE-ACTIVE-CANDIDATE'; creation_stage='setup'; id=$profileCandidate; auth_user_id=$authUsers.active_candidate.auth_user_id; email=$authUsers.active_candidate.email; full_name='RLSV4-P5-V6-PROFILE-ACTIVE-CANDIDATE'; role='candidate'; status='active'; organization_id=$null; client_id=$null; candidate_id=$candidateA }
        )
        invites = @()
        memberships = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-MEMBERSHIP-A'; creation_stage='setup'; id=(& $newId 'membership-a'); user_profile_id=$profileClient; organization_id=$orgClientA; client_id=$clientA; status='active' }
        )
        candidate_accounts = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-CANDIDATE-ACCOUNT-A'; creation_stage='setup'; id=(& $newId 'candidate-account-a'); user_profile_id=$profileCandidate; candidate_id=$candidateA; status='active' }
        )
    }

    $adminRuntime = [ordered]@{
        organizations = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-ORG-INTERNAL-B'; creation_stage='admin_runtime'; id=$orgInternalB; name='RLSV4-P5-V6-ORG-INTERNAL-B'; organization_type='internal'; status='active' }
        )
        profiles = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-PROFILE-INACTIVE-CANDIDATE'; creation_stage='admin_runtime'; id=$profileInactiveCandidate; auth_user_id=$authUsers.inactive_candidate.auth_user_id; email=$authUsers.inactive_candidate.email; full_name='RLSV4-P5-V6-PROFILE-INACTIVE-CANDIDATE'; role='candidate'; status='inactive'; organization_id=$null; client_id=$null; candidate_id=$candidateB }
        )
        invites = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-INVITE-CLIENT-B'; creation_stage='admin_runtime'; id=(& $newId 'invite-client-b'); email='phase5-v6-invite@example.invalid'; invited_role='client'; organization_id=$orgClientB; client_id=$clientB; candidate_id=$null; status='pending' }
        )
        memberships = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-MEMBERSHIP-B'; creation_stage='admin_runtime'; id=(& $newId 'membership-b'); user_profile_id=$profileInvited; organization_id=$orgClientB; client_id=$clientB; status='active' }
        )
        candidate_accounts = @(
            [ordered]@{ logical_reference='RLSV4-P5-V6-CANDIDATE-ACCOUNT-B'; creation_stage='admin_runtime'; id=(& $newId 'candidate-account-b'); user_profile_id=$profileInactiveCandidate; candidate_id=$candidateB; status='active' }
        )
    }

    $deniedKeys = @('anon','no_profile','invited_client','inactive_candidate','active_recruiter_manager','active_recruiter','active_client','active_candidate')
    $deniedAttempts = [ordered]@{}
    foreach ($key in $deniedKeys) {
        $attemptClientId = & $newId "attempt-$key-client"
        $attemptCandidateId = & $newId "attempt-$key-candidate"
        $deniedAttempts[$key] = [ordered]@{
            organization = [ordered]@{ logical_reference="RLSV4-P5-V6-ATTEMPT-$($key.ToUpperInvariant())-ORG"; creation_stage='runtime_denied'; id=(& $newId "attempt-$key-org"); name="RLSV4-P5-V6-ATTEMPT-$($key.ToUpperInvariant())-ORG"; organization_type='internal'; status='active' }
            profile = [ordered]@{ logical_reference="RLSV4-P5-V6-ATTEMPT-$($key.ToUpperInvariant())-PROFILE"; creation_stage='runtime_denied'; id=(& $newId "attempt-$key-profile"); auth_user_id=$authUsers.no_profile.auth_user_id; email=$authUsers.no_profile.email; full_name="RLSV4-P5-V6-ATTEMPT-$($key.ToUpperInvariant())-PROFILE"; role='guest'; status='invited'; organization_id=$null; client_id=$null; candidate_id=$null }
            invite = [ordered]@{ logical_reference="RLSV4-P5-V6-ATTEMPT-$($key.ToUpperInvariant())-INVITE"; creation_stage='runtime_denied'; id=(& $newId "attempt-$key-invite"); email="phase5-v6-$($key.Replace('_','-'))@example.invalid"; invited_role='client'; organization_id=$orgClientA; client_id=$clientA; candidate_id=$null; status='pending' }
            membership = [ordered]@{ logical_reference="RLSV4-P5-V6-ATTEMPT-$($key.ToUpperInvariant())-MEMBERSHIP"; creation_stage='runtime_denied'; id=(& $newId "attempt-$key-membership"); user_profile_id=$profileClient; organization_id=$orgClientB; client_id=$attemptClientId; status='active' }
            candidate_account = [ordered]@{ logical_reference="RLSV4-P5-V6-ATTEMPT-$($key.ToUpperInvariant())-CANDIDATE"; creation_stage='runtime_denied'; id=(& $newId "attempt-$key-candidate-account"); user_profile_id=$profileInvited; candidate_id=$attemptCandidateId; status='active' }
        }
    }

    $immutableAttempts = [ordered]@{}
    foreach ($key in @('anon','no_profile','invited_client','active_admin','inactive_candidate','active_recruiter_manager','active_recruiter','active_client','active_candidate')) {
        $immutableAttempts[$key] = [ordered]@{
            audit = [ordered]@{
                logical_reference="RLSV4-P5-V6-IMMUTABLE-$($key.ToUpperInvariant())-AUDIT"
                id=(& $newId "immutable-$key-audit")
                actor_profile_id=$null
                action='phase5-v6-denied'
                resource_type='phase5-v6'
                resource_id="RLSV4-P5-V6-IMMUTABLE-$($key.ToUpperInvariant())"
                result='denied'
                safe_metadata=[ordered]@{ batch=$batch; identity=$key }
            }
            provenance = [ordered]@{
                logical_reference="RLSV4-P5-V6-IMMUTABLE-$($key.ToUpperInvariant())-PROVENANCE"
                id=(& $newId "immutable-$key-provenance")
                bootstrap_reference="RLSV4-P5-V6-IMMUTABLE-$($key.ToUpperInvariant())"
                organization_id=$foundation.organization_id
                admin_profile_id=$foundation.profile_id
                auth_user_id=$foundation.auth_user_id
                normalized_admin_email=$authUsers.active_admin.email
                bootstrap_type='initial_owner'
            }
        }
    }

    $config = [ordered]@{
        config_version = 'phase5-fixtures-v6'
        batch_reference = $batch
        existing_foundation = $foundation
        auth_users = $authUsers
        setup = $setup
        admin_runtime = $adminRuntime
        denied_attempts = $deniedAttempts
        immutable_attempts = $immutableAttempts
    }

    Assert-NoForbiddenConfigKeys $config

    $allPrimaryIds = @()
    foreach ($section in @($setup,$adminRuntime)) {
        foreach ($table in @('organizations','profiles','invites','memberships','candidate_accounts')) {
            $allPrimaryIds += @($section[$table] | ForEach-Object { $_.id })
        }
    }
    foreach ($entry in $deniedAttempts.Values) {
        $allPrimaryIds += @($entry.organization.id,$entry.profile.id,$entry.invite.id,$entry.membership.id,$entry.candidate_account.id)
    }
    foreach ($entry in $immutableAttempts.Values) {
        $allPrimaryIds += @($entry.audit.id,$entry.provenance.id)
    }
    if (($allPrimaryIds | Sort-Object -Unique).Count -ne $allPrimaryIds.Count) {
        throw 'phase5_v6_primary_uuid_duplicate'
    }

    $allPrivateIds = @($allPrimaryIds) + @($clientA,$clientB,$candidateA,$candidateB) + @($authUsers.Values.auth_user_id)
    if ($allPrivateIds | Where-Object { $foundation.Values -contains $_ }) {
        throw 'phase5_v6_foundation_overlap'
    }

    $json = $config | ConvertTo-Json -Depth 20 -Compress
    $configB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
    $roundTrip = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($configB64)) | ConvertFrom-Json
    if ($roundTrip.config_version -ne 'phase5-fixtures-v6' -or
        @($roundTrip.auth_users.PSObject.Properties).Count -ne 8 -or
        $roundTrip.setup.organizations.Count -ne 3 -or
        $roundTrip.setup.profiles.Count -ne 6 -or
        $roundTrip.admin_runtime.organizations.Count -ne 1 -or
        @($roundTrip.denied_attempts.PSObject.Properties).Count -ne 8 -or
        @($roundTrip.immutable_attempts.PSObject.Properties).Count -ne 9) {
        throw 'phase5_v6_roundtrip_invalid'
    }

    if ($OutputMode -eq 'Clipboard') {
        Set-Clipboard -Value $configB64
        Write-Output 'Phase 5 V6 private fixture configuration validated and copied to clipboard.'
        Write-Output 'WARNING: Clipboard now contains sensitive fixture configuration. Clear it immediately after rendering SQL.'
        Write-Output 'Clear command: Set-Clipboard -Value ""'
    }
    else {
        Write-Output 'Phase 5 V6 private fixture configuration validated. Clipboard unchanged.'
    }
}
finally {
    Remove-Variable config,json,configB64,roundTrip,foundation,namespace,newId,identitySpecs,authUsers,setup,adminRuntime,deniedAttempts,immutableAttempts,allPrimaryIds,allPrivateIds,privateValues -ErrorAction SilentlyContinue
    [GC]::Collect()
}

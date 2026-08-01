[CmdletBinding()]
param(
    [ValidateSet('Live','SelfTest')]
    [string] $Mode = 'SelfTest',
    [ValidateSet('Clipboard','SecurePrompt')]
    [string] $FixtureInputMode = 'Clipboard'
)

$ErrorActionPreference = 'Stop'

function Read-PrivateText {
    param([Parameter(Mandatory)][string] $Prompt)
    $secureValue = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secureValue.Dispose()
    }
}

function Add-PrivateLeaves {
    param(
        [object]$Value,
        [Collections.Generic.HashSet[string]]$Set,
        [string]$KeyName = ''
    )
    if ($null -eq $Value) { return }
    if ($Value -is [string]) {
        $sensitiveKey = $KeyName -match '(?i)(password|email|url|key|token|jwt|fixtureConfigB64|(^|_)id$)'
        $sensitiveShape = (
            $Value -match '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}' -or
            $Value -match '[^@\s]+@[^@\s]+\.[^@\s]+' -or
            $Value -match '(?i)https?://|postgres(?:ql)?://' -or
            $Value -match 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' -or
            $Value -match '(?i)sb_(publishable|secret)_' -or
            $Value -match '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
        )
        if ($Value.Length -ge 8 -and ($sensitiveKey -or $sensitiveShape)) {
            [void]$Set.Add($Value)
        }
        return
    }
    if ($Value -is [Collections.IDictionary]) {
        foreach ($key in $Value.Keys) {
            Add-PrivateLeaves $Value[$key] $Set ([string]$key)
        }
        return
    }
    if ($Value -is [Collections.IEnumerable]) {
        foreach ($item in $Value) { Add-PrivateLeaves $item $Set $KeyName }
        return
    }
    foreach ($property in $Value.PSObject.Properties) {
        Add-PrivateLeaves $property.Value $Set $property.Name
    }
}

function Assert-SanitizedEvidence {
    param(
        [Parameter(Mandatory)][string] $JsonText,
        [Parameter(Mandatory)][Collections.Generic.HashSet[string]] $PrivateValues
    )
    try { $evidence = $JsonText | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'phase5_v6_launcher_evidence_json_invalid' }

    if ($evidence.version -ne 'phase5-runtime-rls-v6' -or
        $evidence.mode -ne 'live' -or
        $evidence.productionAccessed -ne $false -or
        $evidence.sequential -ne $true -or
        @($evidence.identities).Count -ne 9) {
        throw 'phase5_v6_launcher_evidence_structure_invalid'
    }
    foreach ($identity in @($evidence.identities)) {
        if ([string]::IsNullOrWhiteSpace($identity.identityReference) -or
            $identity.sessionCleared -ne $true -or
            @($identity.tests).Count -lt 1) {
            throw 'phase5_v6_launcher_identity_evidence_invalid'
        }
        foreach ($test in @($identity.tests)) {
            if ($test.table -notin @(
                'organizations','user_profiles','user_invites',
                'client_memberships','candidate_accounts',
                'access_audit_logs','staging_auth_bootstrap_provenance'
            ) -or $test.operation -notin @('select','insert','update','delete')) {
                throw 'phase5_v6_launcher_test_evidence_invalid'
            }
        }
    }

    $patterns = @(
        '\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b',
        '\b[^@\s]+@[^@\s]+\.[^@\s]+\b',
        '\bhttps?://\S+',
        '\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b',
        '\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b',
        '\b(?:postgres(?:ql)?|mysql|mssql|mongodb(?:\+srv)?):\/\/\S+',
        '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
    )
    foreach ($pattern in $patterns) {
        if ([regex]::IsMatch($JsonText,$pattern,[Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            throw 'phase5_v6_launcher_sensitive_shape_detected'
        }
    }
    foreach ($privateValue in $PrivateValues) {
        if ($JsonText.Contains($privateValue)) {
            throw 'phase5_v6_launcher_private_value_detected'
        }
    }
    return $evidence
}

$scriptPath = Resolve-Path -LiteralPath 'scripts/stagingPhase5RuntimeRlsValidationV6.ts'
$process = $null
$stagingUrl = $null
$anonKey = $null
$fixtureB64 = $null
$fixtureJson = $null
$fixtureConfig = $null
$inputObject = $null
$inputJson = $null
$outputJson = $null
$privateValues = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)

try {
    if ($Mode -eq 'SelfTest') {
        $psi = [Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = 'node'
        $psi.Arguments = "--experimental-strip-types `"$($scriptPath.Path)`" --self-test"
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $process = [Diagnostics.Process]::Start($psi)
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0 -or
            @($stdout -split "`r?`n" | Where-Object { $_ -match ': PASS$' }).Count -ne 40) {
            throw 'phase5_v6_launcher_self_test_failed'
        }
        $stdout.TrimEnd() | Write-Output
        Write-Output 'Phase 5 V6 launcher self-test: PASS'
        return
    }

    $confirmation = Read-Host 'Type exactly: AI-RECRUITER-STAGING ONLY'
    if ($confirmation -cne 'AI-RECRUITER-STAGING ONLY') {
        throw 'phase5_v6_staging_confirmation_failed'
    }

    $stagingUrl = Read-PrivateText 'Dedicated staging Supabase URL'
    $anonKey = Read-PrivateText 'Dedicated staging anon/publishable key'
    if ($stagingUrl -notmatch '^https://[A-Za-z0-9.-]+$' -or
        [string]::IsNullOrWhiteSpace($anonKey)) {
        throw 'phase5_v6_launcher_staging_input_invalid'
    }

    if ($FixtureInputMode -eq 'Clipboard') {
        $fixtureB64 = Get-Clipboard -Raw
        Set-Clipboard -Value ''
    }
    else {
        $fixtureB64 = Read-PrivateText 'Private Phase 5 V6 fixture Base64'
    }

    try {
        $fixtureJson = [Text.Encoding]::UTF8.GetString(
            [Convert]::FromBase64String($fixtureB64)
        )
        $fixtureConfig = $fixtureJson | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw 'phase5_v6_launcher_fixture_invalid'
    }
    if ($fixtureConfig.config_version -ne 'phase5-fixtures-v6' -or
        @($fixtureConfig.auth_users.PSObject.Properties).Count -ne 8) {
        throw 'phase5_v6_launcher_fixture_shape_invalid'
    }

    $identityOrder = @(
        'no_profile','invited_client','inactive_candidate','active_admin',
        'active_recruiter_manager','active_recruiter','active_client',
        'active_candidate'
    )
    $identities = @()
    foreach ($key in $identityOrder) {
        $password = Read-PrivateText "Password for $key"
        if ([string]::IsNullOrWhiteSpace($password)) {
            throw 'phase5_v6_launcher_password_missing'
        }
        $identities += [ordered]@{ key=$key; password=$password }
    }

    $inputObject = [ordered]@{
        stagingUrl = $stagingUrl
        anonKey = $anonKey
        fixtureConfigB64 = $fixtureB64
        fixtureConfig = $fixtureConfig
        identities = $identities
    }

    Add-PrivateLeaves $inputObject $privateValues
    $inputJson = $inputObject | ConvertTo-Json -Depth 30 -Compress

    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = 'node'
    $psi.Arguments = "--experimental-strip-types `"$($scriptPath.Path)`" --live-stdin"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($psi)

    $process.StandardInput.Write($inputJson)
    $process.StandardInput.Close()
    $outputJson = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
        throw 'phase5_v6_runtime_failed'
    }

    $evidence = Assert-SanitizedEvidence -JsonText $outputJson -PrivateValues $privateValues
    $outputJson.TrimEnd() | Write-Output
    Write-Output 'Phase 5 V6 sanitized runtime evidence: PASS'
}
finally {
    Set-Clipboard -Value ''
    if ($process -and -not $process.HasExited) {
        try { $process.Kill() } catch {}
    }
    if ($inputObject -and $inputObject.identities) {
        foreach ($identity in $inputObject.identities) { $identity.password = '' }
    }
    Remove-Variable process,stagingUrl,anonKey,fixtureB64,fixtureJson,fixtureConfig,inputObject,inputJson,outputJson,privateValues,identities,password,evidence,stdout,stderr -ErrorAction SilentlyContinue
    [GC]::Collect()
}

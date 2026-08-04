[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Preflight','Setup','Cleanup','PartialRecovery','PostCleanup')]
    [string] $Artifact,
    [ValidateSet('Clipboard','SecurePrompt')]
    [string] $InputMode = 'Clipboard',
    [string] $TemporaryOutputPath
)

$ErrorActionPreference = 'Stop'
$token = '__STAGING_PHASE5_FIXTURE_CONFIG_B64__'
$templates = @{
    Preflight = 'supabase/preflight/202607310018_staging_phase5_runtime_rls_preflight_v6.sql'
    Setup = 'supabase/phase5/202607310019_staging_phase5_public_fixture_setup_v6.sql'
    Cleanup = 'supabase/phase5/202607310020_staging_phase5_public_fixture_cleanup_v6.sql'
    PartialRecovery = 'supabase/phase5/202607310021_staging_phase5_partial_recovery_cleanup_v6.sql'
    PostCleanup = 'supabase/preflight/202607310022_staging_phase5_post_cleanup_verification_v6.sql'
}

$configB64 = $null
$rendered = $null
$decodedBytes = $null
$decodedText = $null
$parsed = $null
$secure = $null
$ptr = [IntPtr]::Zero

try {
    $templatePath = Resolve-Path -LiteralPath $templates[$Artifact]
    $template = [IO.File]::ReadAllText($templatePath)
    if ([regex]::Matches($template,[regex]::Escape($token)).Count -ne 1) {
        throw 'phase5_v6_renderer_token_count_invalid'
    }

    if ($InputMode -eq 'Clipboard') {
        $configB64 = Get-Clipboard -Raw
        Set-Clipboard -Value ' '
    }
    else {
        $secure = Read-Host 'Private Base64 fixture configuration' -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $configB64 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }

    try {
        $decodedBytes = [Convert]::FromBase64String($configB64)
        $decodedText = [Text.Encoding]::UTF8.GetString($decodedBytes)
        $parsed = $decodedText | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw 'phase5_v6_renderer_config_invalid'
    }

    if ($parsed.config_version -ne 'phase5-fixtures-v6') {
        throw 'phase5_v6_renderer_version_invalid'
    }

    $rendered = $template.Replace($token,$configB64)
    if ($rendered.Contains($token)) {
        throw 'phase5_v6_renderer_token_remaining'
    }
    if ($rendered -notmatch '(?im)^\s*BEGIN\s*;') {
        throw 'phase5_v6_renderer_begin_missing'
    }

    if ($Artifact -in @('Preflight','PostCleanup')) {
        if ($rendered -notmatch '(?im)^\s*SET\s+TRANSACTION\s+READ\s+ONLY\s*;') {
            throw 'phase5_v6_renderer_read_only_missing'
        }
        if ($rendered -notmatch '(?im)^\s*ROLLBACK\s*;\s*$') {
            throw 'phase5_v6_renderer_rollback_missing'
        }
        if ($rendered -match '(?im)^\s*COMMIT\s*;') {
            throw 'phase5_v6_renderer_read_only_commit_detected'
        }
    }
    else {
        if ($rendered -notmatch '(?im)^\s*COMMIT\s*;\s*$') {
            throw 'phase5_v6_renderer_commit_missing'
        }
        if ($rendered -match '(?im)^\s*ROLLBACK\s*;') {
            throw 'phase5_v6_renderer_automatic_rollback_detected'
        }
    }

    if ($Artifact -in @('Cleanup','PartialRecovery') -and
        $rendered -match '(?i)\b(LIKE|ILIKE)\b') {
        throw 'phase5_v6_renderer_approximate_targeting_detected'
    }

    if ($TemporaryOutputPath) {
        $repoRoot = [IO.Path]::GetFullPath((Get-Location).Path).TrimEnd('\') + '\'
        $target = [IO.Path]::GetFullPath($TemporaryOutputPath)
        if ($target.StartsWith($repoRoot,[StringComparison]::OrdinalIgnoreCase)) {
            throw 'phase5_v6_renderer_repository_output_forbidden'
        }
        [IO.File]::WriteAllText($target,$rendered,[Text.UTF8Encoding]::new($false))
        Write-Output 'Rendered SQL validated and written outside the repository.'
        Write-Output "WARNING: $target contains private configuration. Delete it immediately after use."
    }
    else {
        Set-Clipboard -Value $rendered
        Write-Output 'Rendered SQL validated and copied to clipboard.'
        Write-Output 'WARNING: Rendered SQL contains private fixture configuration.'
        Write-Output 'After pasting into SQL Editor, clear clipboard with: Set-Clipboard -Value ""'
    }
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    if ($secure) { $secure.Dispose() }
    if ($decodedBytes) { [Array]::Clear($decodedBytes,0,$decodedBytes.Length) }
    Remove-Variable template,configB64,rendered,decodedBytes,decodedText,parsed,secure,ptr -ErrorAction SilentlyContinue
    [GC]::Collect()
}

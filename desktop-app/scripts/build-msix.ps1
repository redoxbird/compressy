# Packs the `deno desktop` payload into an MSIX for Microsoft Store submission.
#
# Pipeline (mirrors build-installer.ps1):
#   payload.tar.xz -> dist/msix/ (AppxManifest.xml + Compressy/ + Assets/)
#   -> MakeAppx pack -> dist/Compressy.msix
# Signing is a separate step: local test uses a self-signed cert
# (New-SelfSignedCertificate -> Trusted People -> SignTool); the Store
# re-signs the submission build, so no purchased cert is needed for Store-only.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-msix.ps1
#   powershell ... -File scripts/build-msix.ps1 -Publisher "CN=Your Store CN"
#   powershell ... -File scripts/build-msix.ps1 -PackOnly   # skip SDK check (stage only)
# Store identity resolves as: explicit flags, then repo-root/.env MS_* vars,
# then test defaults. (.env is gitignored.)
param(
    [string]$Publisher = "",
    [string]$IdentityName = "",
    [string]$PublisherDisplayName = "",
    [switch]$PackOnly
)
$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$payloadDir = Join-Path $repo "dist\Compressy"
$stageDir = Join-Path $repo "dist\msix"
$manifestSrc = Join-Path $PSScriptRoot "..\msix\AppxManifest.xml"
$assetsSrc = Join-Path $PSScriptRoot "..\msix\Assets"
$msixOut = Join-Path $repo "dist\Compressy.msix"

# Store identity: explicit flags win, then repo-root/.env MS_* vars (values
# may be quoted in the file), then test defaults. .env is gitignored.
function Get-DotEnvValue([string]$name) {
    $envFile = Join-Path $repo ".env"
    if (-not (Test-Path $envFile)) { return "" }
    foreach ($line in (Get-Content $envFile)) {
        $t = $line.Trim()
        if ($t -eq "" -or $t.StartsWith("#")) { continue }
        $eq = $t.IndexOf("=")
        if ($eq -lt 1) { continue }
        if ($t.Substring(0, $eq).Trim() -eq $name) {
            $v = $t.Substring($eq + 1).Trim()
            if ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) {
                $v = $v.Substring(1, $v.Length - 2)
            }
            return $v
        }
    }
    return ""
}
if ([string]::IsNullOrWhiteSpace($Publisher)) {
    $Publisher = Get-DotEnvValue "MS_Package_Identity_Publisher"
}
if ([string]::IsNullOrWhiteSpace($Publisher)) { $Publisher = "CN=CompressyTest" }
if ([string]::IsNullOrWhiteSpace($IdentityName)) {
    $IdentityName = Get-DotEnvValue "MS_Package_Identity_Name"
}
if ([string]::IsNullOrWhiteSpace($IdentityName)) { $IdentityName = "Compressy.CompressyApp" }
if ([string]::IsNullOrWhiteSpace($PublisherDisplayName)) {
    $PublisherDisplayName = Get-DotEnvValue "MS_Package_Properties_PublisherDisplayName"
}
if ([string]::IsNullOrWhiteSpace($PublisherDisplayName)) { $PublisherDisplayName = "Compressy" }

$payload = Join-Path $payloadDir "payload.tar.xz"
if (-not (Test-Path $payload)) {
    $payload = Join-Path $repo "dist\Compressy-msi\Compressy\payload.tar.xz"
}
if (-not (Test-Path $payload)) {
    Write-Error "Missing payload.tar.xz - run build:dir or build:msi first"
}

# Version: version.ts APP_VERSION (semver) becomes quad for MSIX Identity
# Version (MSIX needs X.Y.Z.W; Store needs a bump on every submission).
$semver = "1.3.0"
try {
    $vts = Get-Content (Join-Path $repo "desktop-app\version.ts") -Raw
    $m = [regex]::Match($vts, 'APP_VERSION\s*=\s*"([^"]+)"')
    if ($m.Success) { $semver = $m.Groups[1].Value }
} catch {}
$quad = $semver
if ([regex]::IsMatch($quad, "^[0-9]+\.[0-9]+\.[0-9]+$")) { $quad = "$semver.0" }
if (-not [regex]::IsMatch($quad, "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$")) {
    Write-Error ("APP_VERSION '" + $semver + "' is not semver - cannot derive MSIX quad version")
}
Write-Output ("MSIX " + $IdentityName + " version: " + $quad + " (from " + $semver + "), Publisher: " + $Publisher + ", PublisherDisplay: " + $PublisherDisplayName)

# Fresh stage: extract payload, stamp manifest, copy assets.
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir | Out-Null
tar -xf $payload -C $stageDir
Write-Output ("Extracted payload -> " + $stageDir)

$manifest = (Get-Content $manifestSrc -Raw).Replace("__VERSION_QUAD__", $quad).Replace("__IDENTITY_NAME__", $IdentityName).Replace("__PUBLISHER__", $Publisher).Replace("__PUBLISHER_DISPLAY__", $PublisherDisplayName)
$manifest | Set-Content (Join-Path $stageDir "AppxManifest.xml") -Encoding UTF8
if (-not (Test-Path $assetsSrc)) {
    Write-Error "Missing tile assets - run make-tiles first"
}
Copy-Item -Recurse -Force $assetsSrc (Join-Path $stageDir "Assets")
Write-Output "Staged manifest + Assets"

# Same icon embedding as build-installer.ps1: the runtime shell carries no
# icon resources, so without this the titlebar/taskbar fall back to default.
& (Join-Path $PSScriptRoot "embed-icon.ps1") `
    -ExePath (Join-Path $stageDir "Compressy\Compressy.exe") `
    -IcoPath (Join-Path $repo "design\app.ico")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$makeappx = $null
$toolkitRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
if (Test-Path $toolkitRoot) {
    $found = Get-ChildItem -Path $toolkitRoot -Recurse -Filter "MakeAppx.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $makeappx = $found.FullName }
}
foreach ($kit in @("C:\Program Files (x86)\Windows Kits\10\bin", "C:\Program Files\Windows Kits\10\bin")) {
    if (Test-Path $kit) {
        $found = Get-ChildItem -Path $kit -Recurse -Filter "makeappx.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $makeappx = $found.FullName; break }
    }
}
if (-not $makeappx) {
    try { $makeappx = (Get-Command makeappx.exe -ErrorAction Stop).Source } catch {}
}
if (-not $makeappx) {
    Write-Error ("MakeAppx.exe not found - install the Windows 10/11 SDK (or the MSIX Packaging Tool). Staged dir left at " + $stageDir)
}

& $makeappx pack /d $stageDir /p $msixOut /o
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "MSIX: dist\Compressy.msix"
Write-Output "Next: self-sign for local test (SignTool) or submit to Partner Center (Store signs it)."

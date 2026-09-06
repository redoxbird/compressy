# Builds the Compressy Inno Setup installer from the `deno desktop` payload.
# Pipeline: deno task build:dir (bat + payload.tar.xz) -> extract -> ISCC.
$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$payloadDir = Join-Path $repo "dist\Compressy"
$appDir = Join-Path $repo "dist\Compressy-app"
$iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$iss = Join-Path $PSScriptRoot "installer.iss"

$payload = Join-Path $payloadDir "payload.tar.xz"
if (-not (Test-Path $payload)) {
    # Fall back to the build:msi output (same payload content)
    $payload = Join-Path $repo "dist\Compressy-msi\Compressy\payload.tar.xz"
}
if (-not (Test-Path $payload)) {
    Write-Error "Missing payload.tar.xz - run 'deno task build:dir' or 'deno task build:msi' first"
}
if (-not (Test-Path $iscc)) {
    Write-Error "Inno Setup 6 not found at $iscc"
}

# Fresh extraction of the app payload (Compressy.exe + CEF runtime)
if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
New-Item -ItemType Directory -Path $appDir | Out-Null
tar -xf $payload -C $appDir
Write-Output ("Extracted payload -> " + $appDir)

# The deno desktop runtime shell carries no icon resources (--icon only embeds
# into Compressy.dll), so the window title-bar falls back to the CEF/Chrome
# default. Embed the ico into the exe so the title bar and taskbar show it.
& (Join-Path $PSScriptRoot "embed-icon.ps1") `
    -ExePath (Join-Path $appDir "Compressy\Compressy.exe") `
    -IcoPath (Join-Path $repo "design\app.ico")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Sync AppIcon.ico with design/app.ico so Uninstall icon matches (and for fallback)
Copy-Item -Force (Join-Path $repo "design\app.ico") (Join-Path $appDir "Compressy\AppIcon.ico")

# Resolve version from version.ts / deno.json for installer metadata (ensures reinstall is seen as update)
$version = "1.0.0"
try {
    $vts = Get-Content (Join-Path $repo "desktop-app\version.ts") -Raw
    if ($vts -match 'APP_VERSION\s*=\s*"([^"]+)"') { $version = $Matches[1] }
} catch {}
try {
    $dj = Get-Content (Join-Path $repo "desktop-app\deno.json") -Raw | ConvertFrom-Json
    if ($dj.version) { $version = $dj.version }
    # version.ts takes precedence if it was found
    $vts2 = Get-Content (Join-Path $repo "desktop-app\version.ts") -Raw
    if ($vts2 -match 'APP_VERSION\s*=\s*"([^"]+)"') { $version = $Matches[1] }
} catch {}
Write-Output "Installer version: $version"

& $iscc "/DMyAppVersion=$version" $iss
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "Installer: dist\Compressy-setup.exe"

# Self-sign + local install test for the Store MSIX.
# Test-only: the Store re-signs the submission build, so this cert never ships.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sign-msix-local.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$msix = Join-Path $repo "dist\Compressy.msix"

if (-not (Test-Path $msix)) { Write-Error "Missing $msix - run 'deno task build:msix' first" }

# Publisher CN from repo-root/.env (same source as build-msix.ps1).
$publisher = ""
$envFile = Join-Path $repo ".env"
foreach ($line in (Get-Content $envFile)) {
  $t = $line.Trim()
  if ($t.StartsWith("MS_Package_Identity_Publisher=")) {
    $publisher = $t.Substring("MS_Package_Identity_Publisher=".Length).Trim().Trim('"')
  }
}
if ([string]::IsNullOrWhiteSpace($publisher)) { $publisher = "CN=CompressyTest" }
Write-Output ("Publisher: " + $publisher)

# Toolkit signtool (installed via winget Microsoft.MSIX-Toolkit).
$signtool = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages") -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $signtool) { Write-Error "signtool.exe not found - install Microsoft.MSIX-Toolkit via winget" }
Write-Output ("SignTool: " + $signtool)

# Self-signed cert (create once, reuse by subject match).
$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $publisher } | Select-Object -First 1
if (-not $cert) {
  $cert = New-SelfSignedCertificate -Type Custom -Subject $publisher `
    -KeyUsage DigitalSignature -FriendlyName "Compressy MSIX test" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
  Write-Output ("Created cert " + $cert.Thumbprint)
} else {
  Write-Output ("Reusing cert " + $cert.Thumbprint + " exp " + $cert.NotAfter)
}

# Trust it for the current user (required for Add-AppxPackage).
$trusted = Get-ChildItem Cert:\CurrentUser\TrustedPeople | Where-Object { $_.Thumbprint -eq $cert.Thumbprint } | Select-Object -First 1
if (-not $trusted) {
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPeople", "CurrentUser")
  $store.Open("ReadWrite")
  $store.Add($cert)
  $store.Close()
  Write-Output "Cert added to TrustedPeople"
} else {
  Write-Output "Cert already trusted"
}

& $signtool sign /fd SHA256 /sha1 $cert.Thumbprint $msix
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "Signed."

# Sideloading must be allowed (Settings > For developers, else this errors).
Add-AppxPackage -Path $msix -ForceApplicationShutdown
Write-Output "Installed."
Get-AppxPackage -Name "KhizarHasan.compressy*" | Select-Object Name, Version, PackageFamilyName

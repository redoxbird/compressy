# One-time machine setup for MSIX sideload testing (requires elevation).
# Sets AllowAllTrustedApps + DeveloperMode and imports the test cert into
# LocalMachine TrustedPeople. Safe to re-run. Test-only: Store builds are
# re-signed by Microsoft, so none of this affects submission.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-sideload.ps1
$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Output "Requesting elevation..."
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "powershell.exe"
  $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"" + $PSCommandPath + "`""
  $psi.Verb = "runas"
  $p = [System.Diagnostics.Process]::Start($psi)
  $p.WaitForExit()
  exit $p.ExitCode
}

$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$key = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
Set-ItemProperty -Path $key -Name "AllowAllTrustedApps" -Value 1 -Type DWord
Set-ItemProperty -Path $key -Name "AllowDevelopmentWithoutDevLicense" -Value 1 -Type DWord
Write-Output "Sideload keys set (AllowAllTrustedApps + DeveloperMode)."

$publisher = ""
foreach ($line in (Get-Content (Join-Path $repo ".env"))) {
  $t = $line.Trim()
  if ($t.StartsWith("MS_Package_Identity_Publisher=")) {
    $publisher = $t.Substring("MS_Package_Identity_Publisher=".Length).Trim().Trim('"')
  }
}
if ([string]::IsNullOrWhiteSpace($publisher)) { $publisher = "CN=CompressyTest" }

$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $publisher } | Select-Object -First 1
if (-not $cert) { Write-Error "Test cert not found in CurrentUser\My - run sign-msix-local.ps1 first" }
$lm = Get-ChildItem Cert:\LocalMachine\TrustedPeople | Where-Object { $_.Thumbprint -eq $cert.Thumbprint } | Select-Object -First 1
if (-not $lm) {
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPeople", "LocalMachine")
  $store.Open("ReadWrite")
  $store.Add($cert)
  $store.Close()
  Write-Output "Cert imported to LocalMachine\TrustedPeople."
} else {
  Write-Output "Cert already in LocalMachine\TrustedPeople."
}
Write-Output "Sideload setup complete."

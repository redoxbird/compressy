# Verify machine trust + install the signed MSIX.
$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$msix = Join-Path $repo "dist\Compressy.msix"

$thumb = "247AB707F8E96D28648B8452A636EF536C6F15A1"
$lm = Get-ChildItem Cert:\LocalMachine\TrustedPeople | Where-Object { $_.Thumbprint -eq $thumb } | Select-Object -First 1
if ($lm) { Write-Output ("LM trust OK: " + $lm.Subject) } else { Write-Error "Cert NOT in LocalMachine\TrustedPeople - re-run setup-sideload.ps1 elevated" }

Add-AppxPackage -Path $msix -ForceApplicationShutdown
Write-Output "Installed."
Get-AppxPackage -Name "KhizarHasan.compressy*" | Select-Object Name, Version, PackageFamilyName

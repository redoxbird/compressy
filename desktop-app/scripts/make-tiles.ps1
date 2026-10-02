# Renders Store tile/logo PNGs from design/icon.png (1024x1024) via
# System.Drawing — no extra tooling. Run: scripts/make-tiles.ps1
# (or `deno task make-tiles`).
$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$src = Join-Path $repo "design\icon.png"
$assets = Join-Path $PSScriptRoot "..\msix\Assets"

if (-not (Test-Path $src)) { Write-Error "Missing source icon: $src" }
New-Item -ItemType Directory -Path $assets -Force | Out-Null

Add-Type -AssemblyName System.Drawing

# Required pixel sizes (square, transparent background).
$targets = @(
    @{ Name = "Square44x44Logo.png"; Size = 44 },
    @{ Name = "Square71x71Logo.png"; Size = 71 },
    @{ Name = "Square150x150Logo.png"; Size = 150 },
    @{ Name = "Square300x300Logo.png"; Size = 300 },
    @{ Name = "StoreLogo.png"; Size = 50 }
)

$img = [System.Drawing.Image]::FromFile($src)
try {
    foreach ($t in $targets) {
        $bmp = New-Object System.Drawing.Bitmap($t.Size, $t.Size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.Clear([System.Drawing.Color]::Transparent)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($img, 0, 0, $t.Size, $t.Size)
        } finally { $g.Dispose() }
        $out = Join-Path $assets $t.Name
        $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Output ("Wrote " + $out)
    }
} finally { $img.Dispose() }

# Wide310x150: centered square icon on a transparent 310x150 canvas.
$wide = New-Object System.Drawing.Bitmap(310, 150)
$g = [System.Drawing.Graphics]::FromImage($wide)
try {
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $img2 = [System.Drawing.Image]::FromFile($src)
    try { $g.DrawImage($img2, 80, 0, 150, 150) } finally { $img2.Dispose() }
} finally { $g.Dispose() }
$wideOut = Join-Path $assets "Wide310x150Logo.png"
$wide.Save($wideOut, [System.Drawing.Imaging.ImageFormat]::Png)
$wide.Dispose()
Write-Output ("Wrote " + $wideOut)

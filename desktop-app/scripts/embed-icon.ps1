# Embeds design/app.ico into Compressy.exe as RT_GROUP_ICON + RT_ICON resources.
# The `deno desktop` runtime shell carries no icon resources (--icon only
# embeds into Compressy.dll), so the window title-bar and taskbar fall back to
# the Chrome/CEF default. Win32 UpdateResource adds the icon in place.
param(
    [string]$ExePath = "C:\projects\compressy\dist\Compressy-app\Compressy\Compressy.exe",
    [string]$IcoPath = "C:\projects\compressy\design\app.ico"
)
$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ResUpdater {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern IntPtr BeginUpdateResource(string pFileName, bool bDeleteExistingResources);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool UpdateResource(IntPtr hUpdate, IntPtr lpType, IntPtr lpName, ushort wLanguage, byte[] lpData, uint cbData);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool EndUpdateResource(IntPtr hUpdate, bool fDiscard);
}
"@

$ico = [System.IO.File]::ReadAllBytes($IcoPath)
$count = [BitConverter]::ToUInt16($ico, 4)
if ($count -eq 0) { throw "ICO has no images: $IcoPath" }

# Parse ICONDIRENTRYs (16 bytes each at offset 6)
$entries = @()
for ($i = 0; $i -lt $count; $i++) {
    $e = 6 + $i * 16
    $entries += [pscustomobject]@{
        Width   = $ico[$e]
        Height  = $ico[$e + 1]
        Planes  = [BitConverter]::ToUInt16($ico, $e + 4)
        Bpp     = [BitConverter]::ToUInt16($ico, $e + 6)
        Size    = [BitConverter]::ToUInt32($ico, $e + 8)
        Offset  = [BitConverter]::ToUInt32($ico, $e + 12)
    }
}

# GRPICONDIR: 6-byte header + 14-byte GRPICONDIRENTRY per image (id replaces offset)
$group = New-Object System.Collections.Generic.List[byte]
$group.AddRange([BitConverter]::GetBytes([uint16]0))  # reserved
$group.AddRange([BitConverter]::GetBytes([uint16]1))  # type: icon
$group.AddRange([BitConverter]::GetBytes([uint16]$count))
for ($i = 0; $i -lt $count; $i++) {
    $e = $entries[$i]
    $group.Add([byte]$e.Width)
    $group.Add([byte]$e.Height)
    $group.Add([byte]0)  # colors
    $group.Add([byte]0)  # reserved
    $group.AddRange([BitConverter]::GetBytes([uint16]$e.Planes))
    $group.AddRange([BitConverter]::GetBytes([uint16]$e.Bpp))
    $group.AddRange([BitConverter]::GetBytes([uint32]$e.Size))
    $group.AddRange([BitConverter]::GetBytes([uint16]($i + 1)))  # RT_ICON id
}

$RT_ICON = [IntPtr]3
$RT_GROUP_ICON = [IntPtr]14
$LANG_NEUTRAL = [uint16]0

$hUpdate = [ResUpdater]::BeginUpdateResource($ExePath, $false)
if ($hUpdate -eq [IntPtr]::Zero) { throw "BeginUpdateResource failed: $ExePath (err $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))" }

try {
    for ($i = 0; $i -lt $count; $i++) {
        $e = $entries[$i]
        $img = New-Object byte[] $e.Size
        [Array]::Copy($ico, $e.Offset, $img, 0, $e.Size)
        $ok = [ResUpdater]::UpdateResource($hUpdate, $RT_ICON, [IntPtr]($i + 1), $LANG_NEUTRAL, $img, $e.Size)
        if (-not $ok) { throw "UpdateResource RT_ICON $($i+1) failed (err $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))" }
    }
    $groupArr = $group.ToArray()
    $ok = [ResUpdater]::UpdateResource($hUpdate, $RT_GROUP_ICON, [IntPtr]1, $LANG_NEUTRAL, $groupArr, $groupArr.Length)
    if (-not $ok) { throw "UpdateResource RT_GROUP_ICON failed (err $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))" }
} finally {
    $ok = [ResUpdater]::EndUpdateResource($hUpdate, $false)
    if (-not $ok) { throw "EndUpdateResource failed (err $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))" }
}

Write-Output ("Embedded $count icon image(s) into " + $ExePath)

; Compressy installer — installs the `deno desktop` app (Compressy.exe + CEF
; runtime) directly into Program Files with a desktop shortcut. No .bat shim:
; the payload is extracted at build time into dist/Compressy-app/.
;
; Build:  ISCC.exe scripts/installer.iss
; Output: dist/Compressy-setup.exe

#define MyAppName "Compressy"
#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif
#define MyAppPublisher "Deno"
#define MyAppExeName "Compressy.exe"

[Setup]
AppId={{B7E3F2A1-4C5D-4E6F-8A9B-0C1D2E3F4A5B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Compressy
DefaultGroupName={#MyAppName}
OutputDir=..\..\dist
OutputBaseFilename=Compressy-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Force shell to refresh icons after update - version bump triggers overwrite
AppMutex=CompressyAppMutex
; Per-user by default (no UAC); the dialog offers "install for all users" (elevated).
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesInstallIn64BitMode=x64compatible
; Ensure installer overwrites even if same version (icon update)
UsePreviousAppDir=yes
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\dist\Compressy-app\Compressy\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Use exe's embedded icon (updated via embed-icon.ps1) so shortcut tracks exe, not stale .ico
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; IconIndex: 0; Comment: "{#MyAppName} desktop application"
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; IconIndex: 0; Comment: "{#MyAppName} desktop application"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

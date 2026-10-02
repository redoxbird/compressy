# Microsoft Store submission worksheet — Compressy

Source of truth for every value typed into Partner Center. Code values
(`.env` MS_* + `version.ts`) stamp the manifest at pack time; portal-only
values below are typed by hand. Update this file when any value changes.

## 1. Package identity (auto-stamped — do not type)

| Field | Value | Source |
|---|---|---|
| Identity Name | `KhizarHasan.compressy` | `.env` `MS_Package_Identity_Name` |
| Identity Publisher | `CN=37D8E2FF-AD68-47C8-8D29-8F08356789AD` | `.env` `MS_Package_Identity_Publisher` |
| PublisherDisplayName | `Khizar Hasan` | `.env` `MS_Package_Properties_PublisherDisplayName` |
| DisplayName | `Compressy` | `desktop-app/msix/AppxManifest.xml` (template literal) |
| Version (current) | `1.3.0.0` | `desktop-app/version.ts` `APP_VERSION=1.3.0` → quad at pack |
| Min OS | 10.0.17763.0 (1809) | manifest `TargetDeviceFamily MinVersion` |
| Max tested | 10.0.26100.0 | manifest `MaxVersionTested` |
| Package file | `dist/Compressy.msix` (~55 MB) | `deno task build:msix` output |

Rules: bump `APP_VERSION` before every re-submission (Store rejects
re-uploaded quads). Publisher CN must match Partner Center exactly —
character-for-character, including case and dashes.

## 2. Capabilities + certification justifications

Both are restricted (`rescap`) — paste the justification into the
"notes for certification" field at submission.

| Capability | Why it is required (paste-ready) |
|---|---|
| `runFullTrust` | Compressy is a Win32 desktop app: a native launcher plus a vendored libvips image engine (`vips.exe`, spawned as hidden subprocesses) and a PowerShell-based native folder picker. Full-trust execution is the only model that supports subprocess image processing. |
| `broadFileSystemAccess` | Compressy is a batch folder compressor: the user picks an arbitrary folder (photos library, network share, external drive) and the app scans it recursively, writes compressed outputs beside originals, and keeps backups in a `backup/` subfolder. Picker-only access cannot cover recursive folder scans, per-file backup writes, or CSV export to the source folder. |

Fallback if cert pushes back on `broadFileSystemAccess`: drop it from the
manifest (one-line removal), resubmit picker-scoped. Folder-wide scan and
backup writes degrade; single-file flows keep working.

## 3. Listing inputs (typed in Partner Center)

| Field | Value / status |
|---|---|
| App name (reserved) | `Compressy` — must match manifest DisplayName |
| Category | Utilities → File Management (confirm at submission) |
| Pricing | Free (decided; change here if that changes) |
| Availability | Markets: all where Store supports desktop apps, or restrict — decide at submission |
| Description (short, ~50 chars) | Batch-compress JPG, PNG, WebP and AVIF — 100% offline on your PC. |
| Description (long — paste-ready draft) | Compressy shrinks whole folders of images without uploading anything. Pick a folder, tune quality, format, resize and rename, and compress with live per-file progress. JPG, PNG, WebP and AVIF in and out. Overwrites back up originals to a `backup/` folder automatically. Settings persist between runs. No account, no cloud, no telemetry — everything runs on your PC. |
| Release notes (1.3.0) | Offline batch compression for JPG/PNG/WebP/AVIF; quality/mode/format controls; resize, auto-rename, sort, grid/list views; dark mode; CSV export. |
| Support contact | TODO — support email or URL required before submission |
| Website | `https://compressy.app` |
| Privacy policy URL | `https://compressy.app/privacy-policy/` (page authored in-repo, H-slice; must be deployed before submission) |

## 4. Features (Store listing bullets — paste-ready)

Keep to 8 bullets, outcome-first, no jargon. Grounded in `types.ts` AppSettings + `worker.ts` pipeline:

- Batch-compress whole folders — recursive scan for JPG, PNG, WebP, AVIF with live per-file progress
- 100% offline and private — no uploads, no account, no telemetry; files never leave your PC
- Smart quality controls — quality 40–95, Balanced / Maximum / Fast engines, lossless toggle for PNG and WebP
- Convert or keep format — keep original, or export everything to WebP, AVIF, or JPEG
- Downscale on the fly — max width / height caps that preserve aspect ratio, output dims shown per file
- Safe overwrites — originals auto-move to a `backup/` folder; nothing is ever deleted
- Auto-rename outputs — `{prefix}-{NNNN}` zero-padded counter with live preview, extension kept
- Organized workflow — subfolder groups with collapse, search / type filter, 7 sort orders, list and grid views with real thumbnails
- Extras that save time — CSV export of savings, right-click Open / Reveal / Compress / Delete, dark / light / auto theme, settings persist between runs

## 5. Screenshots (required — TODO, capture from the running app)

Minimum 1; recommended 3–4 at 1366×768 or larger:

1. Main window with a scanned folder (grid view, thumbnails visible).
2. Compression running or finished (savings summary + per-file before/after).
3. Settings panel open (quality/format/engine bands).
4. Dark mode (optional 4th).

Capture on a clean sample folder (no personal paths in the crumb bar —
`C:\Users\…` in screenshots gets flagged). Store accepts PNG/JPG.
## 6. Age rating (IARC questionnaire — expected answers)

Utility app, no content, no communication, no purchases, no user-generated
content display. Expected outcome: Everyone / 3+. Fill the questionnaire
truthfully at submission; record the actual rating here when received.

## 7. Pre-submission checklist

- [ ] `APP_VERSION` bumped (new quad never uploaded before)
- [ ] `deno task build:dir` rebuilt from clean state (no live `EBWebView/Default/` profile baked in)
- [ ] `deno task build:msix` packs clean; unpack round-trip shows Store identity
- [ ] Local self-signed install smoke passed (scan + compress + settings persist)
- [ ] Privacy page live at `https://compressy.app/privacy-policy/`
- [ ] Support contact decided and entered
- [ ] Screenshots captured (no personal paths)
- [ ] Capability justifications pasted into cert notes
- [ ] App name reservation matches manifest DisplayName
- [ ] Pricing/availability/market set
- [ ] IARC questionnaire completed

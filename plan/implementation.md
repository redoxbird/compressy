# Compressy — Implementation Plan

A simple utility desktop app that batch-compresses images (JPG / PNG / WebP / AVIF) in a user-chosen folder.

- **Backend:** Deno 2.9 (`deno desktop`), built-in Deno APIs only (no server framework)
- **Image processing:** vendored libvips CLI (`vendor/vips/bin/` — vips.exe + vipsthumbnail.exe, v8.18), spawned hidden via `node:child_process` `windowsHide`; pure-Deno header parser for dimensions
- **Frontend:** plain HTML/CSS from [`design/compressy.html`](../design/compressy.html), served over the local HTTP server; htmx + Alpine.js + Handlebars
- **Validation:** `npm:zod` for binding arguments on the trust boundary
- **Target:** Windows 11 (this machine) first; `deno desktop` cross-compiles macOS/Linux later

---

## 1. Grounding (verified against current docs, 2026-08)

| Topic | Finding | Source |
|---|---|---|
| `deno desktop` availability | Stable since Deno 2.9; **Deno 2.9.5 installed locally** | [docs.deno.com/runtime/desktop](https://docs.deno.com/runtime/desktop/) |
| Server model | `Deno.serve()` binds to a Deno-chosen 127.0.0.1 port (`DENO_SERVE_ADDRESS`); webview navigates there. **The port is not overridable** — never hardcode one. | [serving](https://docs.deno.com/runtime/desktop/serving/) |
| Deno → webview calls | `win.bind(name, handler)`; webview calls `bindings.<name>(args)` → Promise. JSON-encoded args; `Uint8Array` supported for binary; errors arrive as `{ name, message, stack }`. | [bindings](https://docs.deno.com/runtime/desktop/bindings/) |
| Native dialogs | `prompt()`, `alert()`, `confirm()` are native popups **on the Deno thread**. File/folder pickers are **not yet a first-class API** (on roadmap). | [dialogs](https://docs.deno.com/runtime/desktop/dialogs/) |
| Webview file paths | `<input type="file">` **never exposes absolute paths** in WebView2 (C:\fakepath sanitization); no File System Access API handle passthrough. → **Folder selection must be a Deno-side `prompt()`** (see §5). | [WebView2Feedback#3706](https://github.com/MicrosoftEdge/WebView2Feedback/issues/3706) |
| vips CLI under Deno | Vendored libvips 8.18 binaries (`vips.exe`, `vipsthumbnail.exe`, DLLs) spawn as subprocesses. `Deno.Command` has **no** `windowsHide` option in 2.9.5 (denoland/deno#34627 wired it only through `node:child_process`) → spawn via `node:child_process` with `windowsHide: true` (CREATE_NO_WINDOW) to suppress console flashes. | [denoland/deno#34627](https://github.com/denoland/deno/pull/34627) |
| HMR | `deno desktop --hmr main.ts` hot-swaps plain-serve apps (no webview reload). | [hmr](https://docs.deno.com/runtime/desktop/hmr/) |
| Window | `new Deno.BrowserWindow()` adopts the startup window; per-window `bind()`; `executeJs()` available. | [windows](https://docs.deno.com/runtime/desktop/windows/) |
| Config | `desktop` block in `deno.json` (app name/identifier/icons/backend/output); permissions flags are baked into the binary at compile time. | [configuration](https://docs.deno.com/runtime/desktop/configuration/) |

**Architecture decisions from the above:**

1. **Bindings are the API, not fetch routes.** `Deno.serve` only serves the UI. All data flows through `win.bind(...)`; per-file progress streams over one `progress` binding call per completed file (no WebSockets, no SSE — nothing to manage).
2. **Deno-side folder picker.** Because the webview can't reveal absolute paths, `Browse…` calls `bindings.pickFolder()` which runs Deno-side `prompt("Path to image folder:", lastPath)` — a native dialog with an editable text field. The path input in the design stays fully functional (paste/type + Enter).
3. **No HTTP API routes, no CORS concerns, no auth.** The page is served from the same 127.0.0.1 origin; `fetch` is only used for static assets.
4. **Concurrency via vips subprocess pool.** Each vips.exe already uses libvips' internal thread pool; the "2/4/8 threads" setting maps to `min(threads, count)` concurrent runner loops, each awaiting its own hidden subprocess. No Deno Workers (module-resolution failures in compiled binaries).
5. **State lives in the frontend.** Files, selection, results are page state (Alpine). The backend is stateless apart from scan + compress calls. Reload restores the last folder + settings from a settings file (Deno-side, via a binding).

---

## 2. Scope

### In scope (v1)
- Pick a folder (native prompt + manual path entry), scan recursively for JPG/PNG/WebP/AVIF
- Settings: quality slider (40–95), engine mode (balanced/max/fast), output format (keep/WebP/AVIF/JPEG), concurrency (2/4/8), strip metadata, overwrite-with-.bak, skip files < 50 KB, lossless toggle, max-width/max-height downscale (keep aspect)
- Select files (click row, select-all, invert, clear), search filter, type filter
- Compress selected with per-file live progress (name + overall %), results list with per-file before/after/savings, header totals, status bar
- Export CSV, open folder in Explorer
- Window chrome (min/max/close) via `Deno.BrowserWindow` events; real window title
- Last-folder + settings persistence; window geometry persistence
- Packaging for Windows

### Design v2 additions (2026-08-18 — from updated `design/compressy.html`)
- **Auto-rename outputs**: toggle + prefix, pattern `{prefix}-{NNNN}.{ext}` (4-digit zero-padded counter, keeps extension), live pattern/example preview in the UI
- **Sort control**: name A–Z / Z–A, size ↓/↑, mtime newest/oldest, type — frontend-only, driven by new `mtime` field on scan results
- **List/grid view toggle** with format-tinted SVG thumbnails (placeholder icons, not real image previews — previews stay out of scope)
- **Collapsible "More settings"** panel: Options (2×2 checkbox grid), Resize, Rename bands behind a header toggle + footer indicator
- **Renamed badge** on result rows (`renamed` flag on `FileResult`)
- **Statusbar engine line** (`vips 8.18` — vendored version, replacing the design's mozjpeg/oxipng placeholder)

**Not implemented (user decision, 2026-08-18):** the design's titlebar min/max/close icon buttons. Native window frame is kept; no custom window controls.

### Out of scope (v1)
- Recursive directory sub-tree *listing* in the UI (single flat list of image files; recursion is for *scanning* only)
- Drag-and-drop folders, multi-folder workspaces, **real image preview thumbnails** (design uses format-tinted placeholder icons), undo of overwrite
- Auto-update, macOS/Linux packaging (cross-compile later; same codebase)
- Reading image bytes into the webview (binaries never cross the boundary)

### Non-goals (explicitly)
- No external server framework (no Oak/Fresh), no bundler, no build step for the frontend (plain static assets + CDN-free local files)
- No node/npm toolchain at runtime — Deno resolves npm packages itself
- No WebSockets/SSE; progress is push-via-binding, one call per file
- No React/Vue/similar — Alpine + htmx + Handlebars per the design language

---

## 3. Tech stack & versions

| Component | Choice | Why |
|---|---|---|
| Runtime | Deno 2.9.5 (installed) | `deno desktop`, Node compat, built-in Worker API |
| Window/backend | `Deno.BrowserWindow` + bindings + `Deno.serve` | Zero-framework, in-process channel |
| Image engine | **Vendored libvips CLI** (`vendor/vips/bin/vips.exe` + `vipsthumbnail.exe`, v8.18) | Sharp was replaced during implementation: the CLI avoids N-API/compiled-binary risk entirely. Spawns are hidden with `windowsHide: true` via `node:child_process` (Deno.Command lacks the option in 2.9.5) |
| Image header parsing | **Pure-Deno parser** (`image-header.ts`) | Width/height from file headers — zero subprocesses, works in compiled VFS |
| Validation | `npm:zod` (pin `^3` or latest 3.x) | Validate every binding arg at the trust boundary |
| Frontend | htmx `^2` + Alpine.js `^3` (pin) + Handlebars `^4.7` (pin) | No bundler; three local files + CDN-style script tags served by the app |
| Templating | Handlebars, **runtime compile, no precompile step** | Lists are small; `Handlebars.compile()` in the browser is fine |

All frontend libs are downloaded once (during implementation) into `static/vendor/` and served locally — **no CDN at runtime** (offline-capable desktop app).

---

## 4. Project layout

```
compressy/
├── plan/
│   ├── implementation.md      # this file
│   └── tasks.csv              # task tracker (populated from §12)
├── design/
│   └── compressy.html         # design reference — untouched
└── desktop-app/               # the app
    ├── deno.json              # imports map, desktop config, tasks
    ├── main.ts                # entry: serve static + adopt window + register bindings
    ├── bindings.ts            # all win.bind() registrations; zod-validated handlers
    ├── types.ts               # shared TS types (FileEntry, Settings, CompressRequest, Result)
    ├── scanner.ts             # recursive scan + pure-Deno header metadata
    ├── compressor.ts          # per-file compress pipeline + concurrency pool
    ├── worker.ts              # per-file vips pipeline (encode args, resize, rename, .bak)
    ├── vips.ts                # vips binary resolver + runner (node:child_process, windowsHide)
    ├── image-header.ts        # pure-Deno JPEG/PNG/WebP/AVIF header parser (w/h)
    ├── settings.ts            # settings + last-folder + window-geometry persistence (JSON in app data dir)
    ├── version.ts             # version string used by UI + window title
    ├── vendor/vips/           # vendored libvips binaries (vips.exe, vipsthumbnail.exe, DLLs)
    ├── static/
    │   ├── index.html         # real app page (design markup + Alpine hooks)
    │   ├── styles.css         # design's CSS, trimmed of demo-only bits
    │   ├── app.js             # Alpine data, bindings calls, Handlebars rendering
    │   ├── templates.js       # Handlebars templates as JS template strings (compiled at load)
    │   └── vendor/
    │       ├── htmx.min.js
    │       ├── alpine.min.js
    │       └── handlebars.min.js
    └── tests/
        ├── scanner_test.ts
        ├── compressor_test.ts
        ├── settings_test.ts
        └── helpers.ts          # tiny generated images (PPM → vips)
```

**Why this shape:** everything plain, one entry point, no framework layering. The `desktop-app/` folder already exists (empty) — this is its home. The design file stays untouched as the visual reference.

---

## 5. Architecture

```mermaid
flowchart LR
    subgraph Webview
        A[index.html<br/>htmx + Alpine + Handlebars]
    end
    subgraph Deno runtime (same process)
        S[Deno.serve<br/>serves /static/* only]
        B[bindings.ts<br/>zod-validated handlers]
        C[compressor.ts<br/>subprocess pool 2/4/8]
        W1[vips.exe + vipsthumbnail.exe]
        W2[vips.exe + vipsthumbnail.exe]
        W3[...]
        D[scanner.ts + image-header.ts]
        T[settings.ts<br/>JSON in app-data dir]
    end
    A -->|HTTP fetch| S
    A -->|bindings.scan / compress / export / pickFolder / settings| B
    B --> C
    C --> W1 & W2 & W3
    B --> D
    B --> T
```

### 5.1 Serving (main.ts)

```ts
// main.ts (skeleton)
const APP_VERSION = "1.0.0";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = decodeURIComponent(url.pathname);
  if (path === "/" || path === "/index.html") {
    return respond("static/index.html", "text/html; charset=utf-8");
  }
  const mime = MIME[ext(path)];                      // html, css, js, svg, png, ico
  const file = await Deno.readFile(`static${path}`); // simple, safe (no ../: path is URL-decoded once; reject "..")
  return new Response(file, { headers: { "content-type": mime } });
});

const win = new Deno.BrowserWindow({ title: `Compressy — Image Optimizer` });
registerBindings(win);      // bindings.ts
restoreWindowGeometry(win); // settings.ts
```

Rules:
- **No port ever hardcoded.** `Deno.serve` uses `DENO_SERVE_ADDRESS` automatically.
- Static file reads: URL-decode the pathname **once**, reject any segment equal to `..`, serve from `static/` only. No user input reaches the path otherwise.
- Bindings are registered immediately after the window is adopted; the page calls them on Alpine `init`.

### 5.2 Bindings (bindings.ts) — the API contract

Every handler validates its arguments with zod and returns plain JSON-able data (or throws; the error arrives in the webview as `{ name, message, stack }`).

| Binding | Args | Returns | Notes |
|---|---|---|---|
| `pickFolder()` | — | `string \| null` | Webview-side folder picker (CEF exposes full paths on File objects; Deno-side `prompt()` blocks the CEF runtime with no visible dialog) |
| `scan(folder)` | `z.string().min(1)` | `ScanResult { folder, files: FileEntry[] }` | Recursive; sorted by name; see §5.4 |
| `compress(req)` | `CompressRequest` (zod) | `CompressResult { totalBefore, totalAfter, files: FileResult[] }` | One binding call per Compress job; progress via `getProgress()` polling (§5.3) |
| `getProgress()` | — | `ProgressState \| null` | Polled by the webview every 500ms while a job runs |
| `cancelCompress()` | — | `void` | Sets a cancellation flag checked between files |
| `exportCsv(folder, results)` | `z.string()`, `z.array(...)` | `{ path: string }` | Writes `compressy-report-<date>.csv`; returns path for the status bar |
| `openFolder(path)` | `z.string()` | `void` | `spawn("explorer", ["/select,", path], { windowsHide: true })` via `node:child_process` |
| `loadSettings()` | — | `AppSettings` | Merged over defaults |
| `saveSettings(s)` | `AppSettings` (zod) | `void` | Debounced from the UI |
| `getVersion()` | — | `string` | `1.0.0` (from `version.ts`) |

`ScanResult`/`FileEntry`/`CompressRequest`/`FileResult`/`AppSettings` are declared in `types.ts`, and a `Bindings` interface in the same file gives the webview's `bindings` global its types (per the docs' type-safety pattern).

### 5.3 Progress push

- `compress()` is a single long-running binding call. The webview polls
  `getProgress()` (returns `ProgressState { total, done, failed, currentName, running }`)
  — **binding arguments are JSON-encoded, so function callbacks cannot cross the
  boundary** (the plan's original `onFileDone` design is not implementable).
  Polling also gives htmx a natural role: `hx-trigger="every 500ms"` on the
  progress bar.
- The pool updates a shared `ProgressState` as files complete; the
  `compress()` promise resolves when all files settle (or cancel), returning the
  full `CompressResult`.
- **Cancellation:** `cancelCompress()` flips a flag checked between files; the
  job resolves early with `cancelled: true`.

### 5.4 Scanner (scanner.ts)

```ts
const SUPPORTED_EXTS: Record<string, ImageExt> = {
  jpg: "jpg", jpeg: "jpg", png: "png", webp: "webp", avif: "avif",
};

export async function scanFolder(root: string): Promise<ScanResult> {
  const rootAbs = resolve(root);
  const files: FileEntry[] = [];
  let errors = 0;
  const pending = [rootAbs];
  while (pending.length) {
    const dir = pending.pop()!;
    let entries: Deno.DirEntry[];
    try { entries = [...Deno.readDirSync(dir)]; } catch { errors++; continue; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory) { pending.push(full); continue; }
      if (!entry.isFile) continue;
      const ext = SUPPORTED_EXTS[extOf(entry.name)];
      if (!ext) continue;
      let stat: Deno.FileInfo;
      try { stat = await Deno.stat(full); } catch { errors++; continue; }
      const meta = imageMeta(full);            // pure-Deno header parser, no subprocess
      if (!meta) { errors++; continue; }       // corrupt/unreadable → count, never fail
      files.push({ path: full, name: entry.name, ext, size: stat.size, w: meta.w, h: meta.h, mtime: stat.mtime?.getTime() ?? 0 });
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { folder: rootAbs, files, errors };
}
```

- `imageMeta` reads only the file header (pure-Deno parser in `image-header.ts`, no pixel decode, no subprocess) — cheap even for thousands of files.
- **`mtime` (epoch ms) is new in design v2** — drives the "Newest/Oldest first" sort options.
- Unreadable subfolders / corrupt files: skip + collect into `scan.errors` (shown as a count in the UI), never fail the whole scan.
- Runs on the main thread (I/O-bound); pixel work is what gets parallelized.

### 5.5 Compressor (compressor.ts + worker.ts + vips.ts)

**Request schema (zod), the single source of truth for compression:**

```ts
const CompressRequestSchema = z.object({
  files: z.array(z.object({
    path: z.string().min(1),
    name: z.string().min(1),
    ext: z.enum(["jpg", "png", "webp", "avif"]),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  })),
  quality: z.number().int().min(40).max(95),
  mode: z.enum(["balanced", "max", "fast"]),
  format: z.enum(["keep", "webp", "avif", "jpeg"]),
  lossless: z.boolean(),
  stripMeta: z.boolean(),
  overwrite: z.boolean(),
  maxW: z.number().int().positive().nullable(),
  maxH: z.number().int().positive().nullable(),
  resizeOn: z.boolean(),
  threads: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  // design v2:
  renameOn: z.boolean(),
  renamePrefix: z.string().max(24).default(""),
});
```

**Pipeline per file** (`worker.ts` → `vips.ts`):

- `compressOne(file, opts)` runs 1–2 vips subprocesses (spawns minimized by design — each costs ~600ms startup):
  - same-format + resize → 1 `vipsthumbnail.exe` call (writes final file, `--keep all` unless stripping)
  - same-format no-resize → 1 `vips.exe <saveop>` call
  - convert (with/without resize) → `vipsthumbnail.exe` to temp, then `vips.exe` save
- **Spawns are console-window-free**: `node:child_process` `spawn`/`spawnSync` with `windowsHide: true` (CREATE_NO_WINDOW). `Deno.Command` has no such option in 2.9.5 (denoland/deno#34627 wired it only through the node path).
- Output dims come from the pure-Deno header parser — 0 extra subprocesses.
- Encode flags per mode × format (`encodeArgs`): balanced/max/fast × jpeg/png/webp/avif (mozjpeg-style `--optimize-coding`, png `--compression`, webp `--effort`, avif `--effort`/`--lossless`).

**Write-out (worker):**
- `overwrite: true` → rename original to `<name>.bak` (collision: keep existing .bak, overwrite new one), write new file in its place.
- `overwrite: false` → write `<stem>-compressed.<target>` next to the original.
- **`renameOn` (design v2)** → output name = `{prefix}-{NNNN}.{ext}` — 4-digit zero-padded counter starting at 0001, keeps the output extension; counter increments per renamed file in job order. `FileResult.renamed: true` when the output name differs from the input name.
- Output smaller than input? Replace/write. **Bigger?** Keep original, mark result `saved: 0` ("no saving") — the design already renders this state.
- Worker returns `FileResult { path, name, ext, w, h, before, after, saved, savedPct, resized, format, renamed? }` (dims = output dims for the results list).

**Pool (main thread, `compressor.ts`):**
- No Web Workers — each vips.exe already uses libvips' internal thread pool; Deno Workers would only add module-resolution failures in compiled binaries. The main thread merely awaits subprocess I/O, so the UI stays responsive.
- `min(threads, count)` concurrent runner loops pull the next file index; results collected in original order; failures become `FileResult { failed: true, error }` and the job continues.
- Progress via `getProgress()` polling (binding args are JSON-encoded — callbacks can't cross the boundary); `cancelCompress()` flips a flag checked between files; job resolves early with `cancelled: true`.

### 5.6 Persistence (settings.ts)

App data dir: `Deno.env.get("LOCALAPPDATA") ?? os.homedir()` → `compressy/` on Windows (path via `Deno.env.get("LOCALAPPDATA")`; fallback `~/.compressy` elsewhere).

- `settings.json` — full `AppSettings` (quality, mode, format, threads, checkboxes, resize dims) + `lastFolder`.
- `window.json` — `{ width, height, x, y }`, written on `resize`/`move` (debounced ~300ms), restored into the `BrowserWindow` constructor (docs' persistence pattern).
- Reads tolerate missing/corrupt files (fall back to defaults); writes are atomic (`writeFile` to `*.tmp` then `rename`).

### 5.7 Frontend (static/)

**index.html** — design markup (titlebar, header stats, folder panel, settings grid, resize strip, split cards, status bar) wired with:
- `hx-get` for nothing (no server partials — see note below) — htmx is used for **declarative polling of the compress job state** where Alpine would need hand-rolled intervals; if we find zero polling needs, htmx is still wired for the scan button (`hx-post="/scan"` is NOT used; see note)
- Alpine components: `workspace` (files, selection, filters, settings model, results, progress), `titlebar` (min/max/close via `bindings.windowMinimize/Maximize/Close`), `statusbar`
- Handlebars templates for `#fileList` rows, `#resultList` rows, empty states — compiled once in `templates.js`

**htmx role (honest):** the app is binding-driven, not server-rendered; htmx adds value only for the compress progress polling if the binding-callback approach proves janky in WebView2. Plan: implement with callbacks first (§5.3). **Add htmx only if** a micro-interaction (e.g. debounced rescan on settings change) needs it — it's included per the request and loaded from `vendor/`, but the architecture does not depend on it. Alpine + Handlebars do the structural work. *(Kept in the stack per requirements; the dependency is real but optional at runtime.)*

**app.js** structure:
```js
const state = Alpine.reactive({
  files: [], selected: new Set(), results: [],
  settings: defaultSettings(), folder: "", scanning: false, compressing: false, progress: {...},
  filter: { search: "", type: "all" },
  async init() { this.settings = await bindings.loadSettings(); ... await this.rescan(); },
  async browse() { const f = await bindings.pickFolder(); if (f) { this.folder = f; await this.rescan(); } },
  async rescan() { this.scanning = true; const r = await bindings.scan(this.folder); this.files = r.files; this.scanning = false; },
  async compress() { /* one bindings.compress(req) call; onFileDone updates this.progress */ },
  async exportCsv() { await bindings.exportCsv(this.folder, this.results); },
  async openFolder() { await bindings.openFolder(this.folder); },
});
```
Every mutating setting change → debounced `bindings.saveSettings(state.settings)`.

---

## 6. Bindings API — full contract (types.ts)

```ts
export interface FileEntry { path: string; name: string; ext: "jpg"|"png"|"webp"|"avif"; size: number; w: number; h: number; mtime: number; }  // mtime: epoch ms (design v2 sort)
export interface ScanResult { folder: string; files: FileEntry[]; errors: number; }
export interface CompressFileInput { path: string; name: string; ext: FileEntry["ext"]; w: number; h: number; }
export interface CompressRequest {
  files: CompressFileInput[];
  quality: number; mode: "balanced"|"max"|"fast"; format: "keep"|"webp"|"avif"|"jpeg";
  lossless: boolean; stripMeta: boolean; overwrite: boolean;
  maxW: number|null; maxH: number|null; resizeOn: boolean; threads: 2|4|8;
  renameOn: boolean; renamePrefix: string;   // design v2
}
export interface FileResult {
  path: string; name: string; ext: string; format: string;
  w: number; h: number; resized: boolean;
  before: number; after: number; saved: number; savedPct: number;
  renamed?: boolean;                          // design v2 — output name differs from input
  failed?: boolean; error?: string;
}
export interface CompressResult { cancelled: boolean; totalBefore: number; totalAfter: number; files: FileResult[]; }
export interface Progress { index: number; total: number; name: string; done: boolean; failed?: boolean; }
export interface AppSettings {
  quality: number; mode: "balanced"|"max"|"fast"; format: "keep"|"webp"|"avif"|"jpeg";
  lossless: boolean; stripMeta: boolean; overwrite: boolean; skipSmall: boolean;
  threads: 2|4|8; maxW: number|null; maxH: number|null; resizeOn: boolean;
  renameOn: boolean; renamePrefix: string;     // design v2
  lastFolder: string|null;
}
export interface Bindings {   // webview global type
  pickFolder(): Promise<string|null>;
  scan(folder: string): Promise<ScanResult>;
  compress(req: CompressRequest): Promise<CompressResult>;
  cancelCompress(): Promise<void>;
  getProgress(): Promise<ProgressState|null>;
  exportCsv(folder: string, results: FileResult[]): Promise<{ path: string }>;
  openFolder(path: string): Promise<void>;
  loadSettings(): Promise<AppSettings>;
  saveSettings(s: AppSettings): Promise<void>;
  getVersion(): Promise<string>;
  windowMinimize(): Promise<void>; windowMaximize(): Promise<void>; windowClose(): Promise<void>;
}
```

---

## 7. Window & app lifecycle (main.ts)

- `new Deno.BrowserWindow({ title: "Compressy", ...restoredGeometry })` adopts the startup window.
- **Native chrome is kept** (frameless would need custom drag regions; the design's titlebar buttons are decorative). The titlebar min/max/close buttons call the `windowMinimize/Maximize/Close` bindings (`win.hide()`/`win.setSize`-toggle/`win.close()`) — they work without fighting the OS title bar.
- `close` event: if a compression job is running, `event.preventDefault()` + `confirm("Compression in progress — quit anyway?")` (native Deno-side dialog), then `win.close()`.
- Process exits when the last window closes (runtime behavior) — no explicit `Deno.exit` needed.
- Version: `1.0.0` in `version.ts`, displayed in the header badge (replacing the design's `v1.4.2 · Windows` placeholder with `v1.0.0 · <os>` via `Deno.build.os`).

---

## 8. deno.json

```jsonc
{
  "name": "@compressy/app",
  "version": "1.0.0",
  "exports": "./main.ts",
  "imports": {
    "zod": "npm:zod@^3.25"
  },
  "tasks": {
    "dev": "deno desktop --hmr --allow-read --allow-write --allow-run --allow-env --allow-sys --allow-ffi --allow-net main.ts",
    "build": "deno task clean && deno task build:dir && deno task build:msi",
    "clean": "deno run --allow-write clean.ts",
    "build:dir": "deno desktop --allow-read --allow-write --allow-run --allow-env --allow-sys --allow-ffi --compress xz --include ./static main.ts",
    "build:msi": "deno desktop --allow-read --allow-write --allow-run --allow-env --allow-sys --allow-ffi --compress xz --include ./static --output ../dist/Compressy-msi/Compressy.msi main.ts",
    "test": "deno test --allow-read --allow-write --allow-env --allow-ffi --no-check"
  },
  "desktop": {
    "app": {
      "name": "Compressy",
      "identifier": "com.compressy.app",
      "icons": { "windows": "../design/app.ico" }
    },
    "backend": "webview",
    "output": { "windows": "../dist/Compressy" }
  },
  "compilerOptions": { "lib": ["deno.window", "dom", "dom.iterable"] }
}
```

Notes:
- **Permissions are baked at compile time** (`--allow-*` on the `desktop` command). Include `--allow-run` (vips subprocesses + open folder in Explorer), `--allow-env`/`--allow-sys` (app-data dir, platform), `--allow-read`/`--allow-write` (scan/compress/export).
- `--include ./vendor/vips` embeds the libvips binaries; `vips.ts` materializes them from the VFS to a real app-data path on first use (VFS files are not spawnable). `--compress xz` shrinks the binary. HMR flag is dev-only.
- `deno.json` `imports` map keeps `npm:` specifiers out of source code.
- Icon: `design/app.ico` generated by `scripts/make-icon.ts` (PNG-in-ICO).

---

## 9. Behavior mapping (design → implementation)

| Design element (compressy.html) | Implementation |
|---|---|
| Titlebar buttons (min/max/close) | `bindings.windowMinimize/Maximize/Close`; native frame still present |
| Header badge `v1.4.2 · Windows` | `v${version} · ${Deno.build.os}` via binding |
| Folder size / Images / Total saved stats | Computed from scan + results in Alpine |
| Path input + Browse… + Rescan | Path input bound to `state.folder` (Enter → rescan); Browse → `pickFolder()` native prompt; Rescan → `scan()` |
| Path pill `12 files` | `state.files.length` |
| Quality slider + `qVal`/`qLabel` | Alpine `x-model.number` on the slider; computed label |
| Engine / Output / Concurrency selects | Settings model; `threads` drives worker count |
| Lossless / Strip meta / Overwrite / Skip <50KB checkboxes | Settings model; skipSmall applied in filtered() like the design's demo JS |
| Resize strip (maxW/maxH/enableResize) | Passed through to vips resize (`vipsthumbnail -s WxH`, downscale only) |
| Source list rows, select-all, search, type filter, clear, invert | Alpine computed `visibleFiles()`; same selection semantics as the demo JS (selection survives filtering) |
| `Compress selected →` (disabled when 0 or running) | `bindings.compress(...)`; button disabled while `compressing` |
| Progress wrap (label, %, bar) | `state.progress` from `onFileDone` callbacks |
| Result rows (before → after, save %, mini-bar, dims) | Handlebars template over `FileResult[]` |
| Saving badge / right footer (avg, peak) | Computed from results (same math as demo JS) |
| Export CSV | `bindings.exportCsv` (server-side file write; browser download API unavailable for real files) |
| Open folder | `bindings.openFolder` → Explorer |
| Status bar (engine versions, saved total) | `getVersion()` + computed totals; drop the `UTF-8 · CRLF` joke pill |
| **Head stats in source card** (folder size / images / total saved) | Computed from scan + results in Alpine; replaces the old separate header block |
| **"More settings" collapse** (header toggle + footer indicator) | `is-open` class on the panel; both toggles share state; bands hidden when closed |
| **Options band 2×2 grid** (lossless/strip/overwrite/skipSmall) | Settings model; skipSmall applied in `visibleFiles()` like the design's demo JS |
| **Resize band** (enableResize + maxW/maxH + hint) | Passed through to vips resize (`-s WxH`, downscale only); fields disabled when toggle off |
| **Rename band** (enableRename + prefix + live pattern) | `renameOn`/`renamePrefix` in settings + `CompressRequest`; live `{prefix}-{NNNN}.{ext}` preview updates on input; band dims when off |
| **Sort select** (name/size/mtime/type × asc/desc) | Frontend-only sort over `visibleFiles()`; mtime from new `FileEntry.mtime` |
| **List/grid view toggle + format-tinted thumbnails** | `view-grid` class on source card; SVG placeholder icons tinted per format (jpg=accent, png=done, webp=success, avif=warn) |
| **Renamed badge on result rows** | `FileResult.renamed` → `<em class="r-renamed">renamed</em>` in the result template |
| **Statusbar engine line** | `vips 8.18` (vendored version constant) — replaces the design's mozjpeg/oxipng placeholder |

The demo script in `compressy.html` (fake progress, random ratios, `FILES` array) is **not ported** — it exists purely to preview the design. All its UI semantics (selection, filters, footers, disabled states) are preserved.

---

## 10. Phased implementation tasks

### Phase A — Scaffold & serve
1. Create `desktop-app/deno.json` (imports, desktop block, tasks) + `version.ts`
2. Create `main.ts` static server (serve `static/` with MIME map + path traversal guard)
3. Create `static/index.html` from the design markup (strip demo script, add Alpine/htmx/Handlebars script tags + Alpine component roots)
4. Copy design CSS → `static/styles.css` (trim demo-only bits)
5. Download htmx/alpine/handlebars into `static/vendor/` (from unpkg/jsdelivr, pinned versions)
6. `deno task dev` smoke test: window opens, page renders, static assets load

### Phase B — Backend core
7. `types.ts` (all contracts above) + zod schemas
8. `settings.ts` (load/save, atomic writes, window geometry persistence)
9. `scanner.ts` (`scanFolder`, pure-Deno header metadata, error-tolerant walk) + `scanner_test.ts`
10. `worker.ts` (vips encode pipeline: resize, strip, encode args per mode/format) + `compressor_test.ts`
11. `compressor.ts` (subprocess pool, shared-index dispatch, progress state, cancel flag)
12. `bindings.ts` (register all bindings; zod-validate every arg) + wire into `main.ts`; `tests/settings_test.ts`

### Phase C — Frontend wiring
13. `templates.js` (Handlebars templates: file rows, result rows, empty states)
14. `app.js` (Alpine workspace: scan, selection, filters, compress, progress, results, CSV, open folder, settings debounce)
15. Window controls (titlebar buttons via bindings) + `close`-during-compression guard
16. Status bar + header badge with real version/OS

### Phase D — Polish & packaging
17. Error states: scan errors count, per-file failure rows, cancel UX — **done (C2 + D1)**
18. Icon (`design/app.ico`) + `deno task build` — **done** (`scripts/make-icon.ts` generates PNG-in-ICO; build produces `dist/Compressy/` + `dist/Compressy-msi/Compressy.msi`)
19. Final smoke test — **done** (see §11; 23 tests + real-image smoke pass)

### Phase E — Design v2 (2026-08-18, from updated `design/compressy.html`)
20. **Backend: rename support** — add `renameOn`/`renamePrefix` to `CompressRequestSchema` + `AppSettingsSchema` (defaults: false/""), `renamed?: boolean` to `FileResultSchema`; `worker.ts` `outputPathFor`/`compressOne` compute `{prefix}-{NNNN}.{ext}` (4-digit counter, keeps output ext, counter per job in job order); `scanner.ts` adds `mtime` (epoch ms) to `FileEntry`; `settings.ts` defaults + migration (old settings files merge over defaults — no schema break)
21. **Backend: tests** — rename counter/zero-padding/extension-kept, renamed flag on result, mtime present in scan results; existing suites stay green
22. **Frontend: index.html restructure** — head stats moved into source card, "More settings" collapse (header toggle + footer button), Options 2×2 grid band, Resize band (toggle + W×H), Rename band (toggle + prefix + live pattern), sort select, list/grid view toggle, statusbar engine line. **No titlebar/window controls** (user decision — native frame kept)
23. **Frontend: styles.css** — port design v2 CSS (bands, panel toggle, view toggle, thumbnails, gcard grid, rename pattern pill, r-renamed badge); trim demo-only bits
24. **Frontend: app.js** — settings sync/read for renameOn/renamePrefix; rename band live preview; sort state + `visibleFiles()` sort (name/size/mtime/type); view mode toggle + grid render; thumbnails in list+grid rows; renamed badge in results; settings collapse state
25. **Frontend: templates.js** — file row (thumb + mtime-aware sub), grid card, result row with renamed badge
26. **Verification** — `deno task dev` smoke: collapse toggles, rename preview, sort orders, grid/list switch, compress with rename on → renamed badge + on-disk names match `{prefix}-{NNNN}.{ext}`; `deno test` green

---

## 11. Verification plan

| Check | How |
|---|---|
| Dev server works | `deno task dev` → window opens, page renders, no console errors (DevTools via `win.openDevtools()` during dev) |
| Vips loads in dev | `deno desktop --hmr` boots without module errors |
| **Vips runs in compiled binary** | **First build is a milestone.** VFS materialization (`vips.ts` `ensureRealFile`) must copy `vendor/vips/bin/*` to app-data before spawning; verify scan+compress in the compiled exe. |
| Scan correctness | Unit test on fixture folders (nested dirs, unsupported files ignored, corrupt file → `errors` count, size/dims correct) |
| Compress correctness | Unit tests: each format in→out, resize dims math, strip metadata, output-larger→keep-original, `.bak` overwrite behavior, failure of one file doesn't abort batch |
| UI end-to-end | Drive the real app (browser/DevTools): browse → scan → select → compress with 4 threads → progress updates → results correct vs. actual file sizes on disk → export CSV → open folder |
| Cancellation | Start a large batch, cancel mid-run, verify partial results + `cancelled` state |
| Persistence | Change settings + window size, close, relaunch: settings/geometry restored |
| `deno test` | All suites green at the end |

---

## 12. Task tracker

The task list above is the implementation tracker; `plan/tasks.csv` is populated from Phase A–E rows (ID, Status, Priority, Phase, Title, Description, Files, Dependencies, Acceptance Criteria, Notes) as work is scheduled. Current status: **Phases A–D done (v1 shipped); Phase E (design v2) planned, not started.**

---

## 13. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| vips subprocess spawn fails in compiled binary (VFS files not spawnable) | Medium | `vips.ts` materializes the bin dir to app-data once (`ensureRealFile`); first-build gate (§11) |
| **Windows WebView2 blank/hidden window with bindings** (denoland/deno#35645 — `app://` scheme regression, open on stable 2.9.5) | **High** | The compiled app runs (vips OK) but the window stays hidden and the server never binds when `win.bind()` is used on the webview backend. Workaround: build with `--backend cef` (bundled Chromium, different navigation path) or use a canary Deno with the fix (#35670). Documented in §14. |
| WebView2 blocks something (fakepath, no FS Access API passthrough) | High for file-picker path | Avoided: CEF exposes full paths on `webkitdirectory` File objects (unlike sanitized browsers); path input remains primary UX |
| Subprocess memory on huge batches | Low | Process files one at a time per runner loop (no batch buffering); results stream out |
| htmx adds little (binding-driven app) | Medium | Included per requirements; scoped to optional micro-interactions; Alpine/Handlebars carry the UI. If it stays unused at the end, it's 32 KB in `vendor/` — acceptable, or trimmable |
| Deno version drift (API changes in `deno desktop`) | Low | Pinned 2.9.5 locally; docs read from current site |

---

## 14. Open questions for implementation

1. **Icon asset** — `design/app.ico` generated by `scripts/make-icon.ts` (PNG-in-ICO). **Resolved during implementation.**
2. **AVIF encode speed** — libvips AVIF is slow at effort 6; "fast" mode uses effort 0, and the default (balanced) uses effort 4. Confirm acceptable on the target machine during Phase D.
3. **htmx** — keep only if a concrete interaction needs it (§5.7); otherwise it stays as a vendored dependency without usage. This is a requirement-compliance decision, defaulting to inclusion.
4. **Rename counter semantics (design v2)** — counter is per-job (0001..N in job order), not per-folder or global. If the design intends a persistent counter across jobs, revisit in Phase E review. Default: per-job.

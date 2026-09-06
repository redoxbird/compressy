# Project Stack — Windows Desktop + Website (Reusable Template)

Copy this file as `stack.md` in a new repo. Replace `{{PLACEHOLDERS}}` and follow `Quickstart`.

> This is the exact stack proven by **Compressy** (Deno 2.9.6 + CEF desktop, Cloudflare Workers + Hono website). All versions are pinned from `deno.lock` / `bun.lock`; commands are copy-paste.

---

## 1. Overview

```
{{APP_Kebab}}/
  desktop-app/   → Windows desktop (Deno + CEF, offline engine)
  website/       → Edge site (Cloudflare Workers + Hono, classless e-* system)
  design/        → HTML source of truth (Figma → .html, app.ico)
  plan/          → Tasks, stack, known-bugs
  dist/          → Built artifacts ({{APP_NAME}}/, {{APP_NAME}}.msi)
```

Two deployables, one `design/` token source. Share `design/app.ico` + version string, deploy separately:
`desktop-app` → MSI/EXE (Win 10 1809+) · `website` → `{{WORKER_NAME}}` Worker + `public/` assets.

---

## 2. Desktop App — `desktop-app/`

**Runtime:** Deno `2.9.6` (stable, `x86_64-pc-windows-msvc`, V8 `15.0.245.2`, TS `6.0.3`) — requires `2.x`. `deno.json`:
```json
{ "name": "{{NPM_SCOPE}}/app", "version": "1.0.0", "exports": "./main.ts",
  "imports": { "zod": "npm:zod@^3.25", "std/path": "jsr:@std/path@^1" } }
```
`deno.lock` exact: `std/path@1.1.6`, `std/assert@1.0.19`, `std/internal@1.0.14`, `zod@3.25.76`, `@aws-sdk/client-s3@3.1116.0` *(optional — Compressy-specific for S3 release upload; omit if your app has no S3, remove from `deno.json` imports and re-lock)* (+ `tslib@2.8.1`, `bowser@2.14.1`, `@smithy/*` transitive).

**Desktop shell:** `deno desktop` **CEF backend** — not Tauri/Electron/Webview. `deno.json`:
```json
"desktop": {
  "app": { "name": "{{APP_NAME}}", "identifier": "{{IDENTIFIER}}", "icons": { "windows": "../design/app.ico" } },
  "backend": "cef",
  "output": { "windows": "../dist/{{APP_NAME}}" }
}
```
`{{IDENTIFIER}}` = reverse-DNS like `com.example.myapp`. Window is `Deno.BrowserWindow` (cast in `main.ts:99-108`, not public types). `Deno.serve` handles `/thumb?path=` + static. `resolveWeb()` probes `static/` (dev) vs embedded VFS (`import.meta.url`).

**Core modules (copy verbatim, rename `APP_NAME` only):**
- `main.ts` — `setupWindow()` + `Deno.serve` router
- `vips.ts` + `vendor/vips` — libvips via FFI, `runThumbnail()` 512px WebP (3.5× card), cached `appDataDir()/thumbs`
- `compressor.ts` / `scanner.ts` / `image-header.ts` / `bindings.ts` — engine (replace with your domain logic)
- `settings.ts` / `types.ts` / `version.ts` — zod settings, `APP_NAME`/`APP_VERSION`
- `static/` — webview UI (embedded via `--include ./static`)
- `vendor/vips` — binaries (embedded)

**Tasks (`deno.json` tasks) — exact, do not change flags:**
```sh
deno task dev              # deno desktop --hmr --backend cef --allow-read --allow-write --allow-run --allow-env --allow-sys --allow-ffi --allow-net main.ts
deno task build:dir        # → ../dist/{{APP_NAME}}  (xz, icon ../design/app.ico, include static+vips)
deno task build:msi        # → ../dist/{{APP_NAME}}-msi/{{APP_NAME}}.msi
deno task build:installer  # build:dir + powershell scripts/build-installer.ps1 (Inno Setup)
deno task vendor:vips      # deno run --allow-read --allow-write --allow-net scripts/vendor-vips.ts
deno task make-icon        # deno run --allow-read --allow-write --allow-env --allow-ffi --allow-run scripts/make-icon.ts
deno task test             # deno test --allow-read --allow-write --allow-env --allow-ffi --allow-run --no-check
deno task clean            # deno run --allow-write clean.ts
```

**Critical learnings (from `plan/known-bugs.csv` — MUST read before changing desktop):**
- **Use `backend: cef`, NEVER `webview` on Windows 11** — `deno desktop --backend webview` (Deno 2.9.5) builds but shows blank window (`MainWindowHandle 0`, no `Deno.serve` port). Root cause `denoland/deno#35645` (app:// scheme regression, fix #35670 2026-07-01 regressed in canary `ddebb900558c`). Workaround is `cef` (current). Only switch back after #35645 ships in stable + smoke test. Note: WebView2 also sanitizes `input[type=file]` paths — would need Deno-side `prompt()` fallback.
- **`deno task test` MUST include `--allow-run`** — without it, `vendor/vips/bin/vips.exe` spawn fails `NotCapable: Requires run access` and 8/10 tests fail. Current `deno.json` test task already has it — keep it.
- **Dev restart `Access is denied — {{APP_NAME}}.dll` (os error 5)** — previous `laufey.exe`/`deno.exe` still locks DLL. Kill lingering `laufey.exe`/`deno.exe` before `deno task dev` restart.

---

## 3. Website — `website/`

**Runtime:** Cloudflare Workers (`wrangler.jsonc` `compatibility_date: 2026-08-01`, `name: {{WORKER_NAME}}`).

**Package manager:** Bun (`bun.lock`, `bunfig.toml` `preload = ["./test/text-preload.ts"]`, `package.json` `type: module`).

**Deps — pin exact from `bun.lock` (ranges in `package.json` for install):**
```json
dependencies: { "hono": "4.13.3", "linkedom": "0.18.13", "mustache": "4.2.0" }
devDependencies: { "@cloudflare/workers-types": "4.20260702.1", "@types/bun": "1.4.0", "wrangler": "4.125.0" }
// also: @cloudflare/workerd 1.20260820.1, esbuild 0.28.1, miniflare 5.20260820.0-alpha
```

**Wrangler (`wrangler.jsonc`) — copy verbatim, only rename `name`/`kv id`:**
```json
{ "main": "worker/index.ts",
  "kv_namespaces": [{ "binding": "CACHE", "id": "{{KV_ID}}" }],
  "assets": { "directory": "./public", "binding": "ASSETS", "not_found_handling": "none", "html_handling": "none", "run_worker_first": ["/","/404.html","/*.html"], "exclude": ["test-images"] },
  "rules": [{ "type": "Text", "globs": ["src/**/*.html"], "fallthrough": true }] }
```
`fallthrough:true` is required or `e-*.html` imports fail at deploy. Test mirror: `test/text-preload.ts` `Bun.plugin onLoad {filter: /[.]html$/}`.

**Worker (`worker/app.ts`):**
- `Hono<{Bindings:{ASSETS:Fetcher;CACHE:KVNamespace}}>`
- `createRegistry(PROD_DEFS,PARTIALS)` → Mustache `LAYOUT_SOURCE` + `PARTIALS`, depth-first `expandPage` (linkedom), `resolveMeta`/`buildJsonLd`, `publicPath`/`SLUGS`
- `revFor = sha256hex(site.url + REGISTRY_VERSION + layout + partial sources + dataJson)` — per-page hash; `REGISTRY_VERSION` bump invalidates 30-day KV.
- Routes: `GET /healthz`, `GET|HEAD /download` (latest from `public/data/releases.json`), `GET /sitemap.xml`, `GET /robots.txt`, `GET *` (expandSlug).

**Element system (`src/elements/`):**
- `index.ts` `PROD_DEFS` + `PARTIALS` (base + `e-{type}--{variant}.html` dispatchers), `ElementApi` (`attrs()`/`slot()`/`slotOuter()`/`child()`/`outer()`/`render()`)
- `registry.ts` `REGISTRY_VERSION`, `createRegistry`, `DomNode`
- `expander.ts` `expandPage(html,ctx,registry)` + `SeoCollector`
- Templates `e-*.html` + `e-{type}--{variant}.html`, `src/layouts/base.html`
- CSS `public/css/site.css` — single file, tokens verbatim from `design/landing.html :root`, one block per `e-*`, responsive `1080/860/560`
**Config:**
- `src/config.ts` `site` (`brand.name/url`, `version`), `src/manifest.ts` `SLUGS` (`{{SLUGS}}` — e.g. 28 in Compressy: `index`, `downloads`, `sections`, `sitemap`, `compress-image*`…), `src/layouts/base.html`, `public/data/releases.json`
**Tooling:**
```sh
bunx wrangler dev   # http://localhost:8787
bun test            # 80 tests; html imports via text-preload.ts or become HTMLBundle
bunx wrangler deploy
```

**TS (`tsconfig.json`):** `ESNext`/`bundler`, `types: ["@cloudflare/workers-types","@types/bun"]`, `strict:true`, `skipLibCheck:true`, `noEmit:true`, `allowImportingTsExtensions:true`, `isolatedModules:true`

**Tests enforce (do not weaken):**
- Classless `public/*.html` (`not.toMatch(/\bclass\s*=/ )` + `style=` ) — `e-*` only.
- `SLUGS` ↔ `public/*.html` sync
- `grep -c "{{>"` dispatchers (e.g. `e-cta` 4)

---

## 4. Shared Conventions

- **TS strict, `allowImportingTsExtensions`** in both apps.
- **Design source:** `design/*.html` → tokens `design/landing.html :root` → `site.css :root`. `design/app.ico` for desktop icon.
- **Classless:** `design/*.html` may have classes (source), `public/*.html` must have zero.
- **Version:** `desktop-app/version.ts` + `website/src/config.ts` `site.version` — keep in sync (`scripts/release.ts`).
- **Data:** `public/data/*.json` memoized per isolate, retry on fail, part of `revFor`.

---

## 5. Quickstart — New App

```sh
mkdir {{APP_KEBAB}} && cd {{APP_KEBAB}}
mkdir -p desktop-app/static desktop-app/vendor desktop-app/scripts desktop-app/tests \
         website/src/elements website/src/layouts website/worker website/public/css website/public/js website/test \
         design plan dist
# 1. Copy verbatim from this repo:
#    desktop-app/deno.json, deno.lock, main.ts, vips.ts, image-header.ts, compressor.ts, scanner.ts, settings.ts, types.ts, bindings.ts, version.ts, worker.ts, clean.ts, static/, vendor/, scripts/
#    website/wrangler.jsonc, bunfig.toml, package.json, tsconfig.json, src/config.ts, src/manifest.ts, src/elements/{registry.ts,expander.ts,index.ts,README.md,e-*.html}, src/layouts/base.html, public/css/site.css, public/js/app.js, test/text-preload.ts, worker/app.ts, worker/index.ts
#    design/app.ico, .omp/RULES.md, plan/known-bugs.csv
#    → Then edit `desktop-app/deno.json` `imports` for your domain (keep `zod`+`std/path` or replace) and re-lock: `deno cache --reload main.ts` (or `deno task vendor:vips` which also writes lock). Do NOT copy `deno.lock` blindly if you changed imports.
# 2. Rename (5 places):
#    deno.json: desktop.app.name="{{APP_NAME}}", identifier="{{IDENTIFIER}}", output.windows="../dist/{{APP_NAME}}"
#    wrangler.jsonc: name="{{WORKER_NAME}}", kv_namespaces[0].id="{{KV_ID}}"
#    src/config.ts: site.brand.name="{{APP_NAME}}", site.url="https://{{DOMAIN}}", site.version="1.0.0"
#    version.ts: APP_NAME="{{APP_NAME}}", APP_VERSION="1.0.0"
#    design/app.ico → your icon
# 3. Install:
#    cd desktop-app && deno task vendor:vips
#    cd ../website && bun install
# 4. Dev:
#    desktop-app: deno task dev          # HMR CEF — if blank window, see Windows Gotchas #1 (stay on cef)
#    website:     bunx wrangler dev
# 5. Build:
#    desktop-app: deno task build:dir && deno task build:msi
#    website:     bunx wrangler deploy
# 6. Add page: `public/{{SLUG}}.html` (classless `e-*`) + `src/manifest.ts` `SLUGS` (test fails until both)
```

**Package Lists (exact pins — copy verbatim, then prune `{{OPTIONAL}}`):**

*Desktop (`desktop-app/deno.json` → `deno.lock`):*
- `zod@3.25.76` (npm) — schema validation (`settings.ts`, `types.ts`)
- `std/path@1.1.6`, `std/assert@1.0.19`, `std/internal@1.0.14` (jsr) — path + tests
- `@aws-sdk/client-s3@3.1116.0` *(optional — Compressy uses for S3 release upload in `scripts/release.ts`; omit if no S3, delete import and re-lock)*
- Transitive: `tslib@2.8.1`, `bowser@2.14.1`, `@smithy/*` (via client-s3)
- Native: `vendor/vips` binaries (`scripts/vendor-vips.ts` fetches libvips, embedded via `--include ./vendor/vips`, FFI in `vips.ts`)

*Website (`website/package.json` → `bun.lock`):*
- `hono@4.13.3` — Worker router (`worker/app.ts`)
- `linkedom@0.18.13` — DOM for `expandPage` (`src/expander.ts`)
- `mustache@4.2.0` — `e-*` templates
- `wrangler@4.125.0`, `@cloudflare/workers-types@4.20260702.1`, `@types/bun@1.4.0` (dev) — `workerd@1.20260820.1`, `esbuild@0.28.1`, `miniflare@5.20260820.0-alpha`

**New element checklist:**
1. `src/elements/e-name.html` (+ `e-name--{variant}.html`)
2. `index.ts` `ElementDef` + import → `PARTIALS`
3. `site.css` block (reuse `var(--*)`, add `1080/860/560`)
4. `app.js` Alpine if needed
5. `test/elements.test.ts` fixture + bump `REGISTRY_VERSION` if mapper invisible to hash

**Windows Desktop Gotchas (from `plan/known-bugs.csv` — genericized):**
1. **CEF vs Webview** — `backend: webview` blank on Win11 (Deno 2.9.5 `MainWindowHandle 0`, `denoland/deno#35645` app:// regression, fix #35670 regressed). Use `backend: cef` (current). One-line switch back to `webview` after #35645 ships stable + smoke test. Also WebView2 sanitizes `input[type=file]` paths → needs Deno-side `prompt()` fallback.
2. **Test `--allow-run`** — `deno task test` MUST include `--allow-run` when spawning native binaries (`vendor/{{NATIVE_BIN}}` e.g. `vips.exe`). Without it 8/10 tests fail `NotCapable: Requires run access to vendor/.../bin/...`.
3. **DLL lock on restart** — `deno task dev` restart fails `Access is denied (os error 5)` while previous `{{LAUFEY_EXE}}`/`deno.exe` still holds `{{APP_NAME}}.dll`. Kill lingering `laufey.exe`/`deno.exe` before restart.

**General Gotchas:**
- `.omp/AGENTS.md` (native, priority 100) shadows `CLAUDE.md`/`AGENTS.md`; `RULES.md` sticky only at `~/.omp/agent/RULES.md` + nearest non-empty `.omp/RULES.md`.
- `Text` rule `src/**/*.html` `fallthrough:true` or deploy fails.
- `bun test` needs `test/text-preload.ts` preload or html → `HTMLBundle`.

---

## 6. References

- Desktop: `desktop-app/deno.json` tasks/desktop, `main.ts` `resolveWeb`/`Deno.BrowserWindow`
- Website: `worker/app.ts` `createApp`, `src/manifest.ts` `SLUGS`, `src/elements/README.md` (slot vs child, data-only tags)
- Tokens: `design/landing.html :root` → `site.css :root`
- Release: `desktop-app/scripts/release.ts` + `design/app.ico` → `dist/`
- Bugs: `plan/known-bugs.csv` (3 open: webview blank, test --allow-run, DLL lock)

# Graph Report - .  (2026-08-29)

## Corpus Check
- Corpus is ~11,767 words - fits in a single context window. You may not need a graph.

## Summary
- 246 nodes · 484 edges · 16 communities (9 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.72)
- Token cost: 9,200 input · 5,100 output

## Community Hubs (Navigation)
- Compression & Scan Pipeline
- Frontend UI Logic
- Desktop Shell & Settings
- Build & Packaging Config
- UI Components & Workspace
- Worker Compression Pipeline
- Vips Runtime & Test Helpers
- Server Entry & Thumbnails
- Binding Type Contracts
- Desktop Window API
- Clean Task
- Header Parsing Rationale
- Clean Script
- Test Fixtures
- Settings Test Suite

## God Nodes (most connected - your core abstractions)
1. `workspace Alpine Component` - 21 edges
2. `registerBindings()` - 20 edges
3. `compressOne()` - 20 edges
4. `renderFiles()` - 17 edges
5. `bindings Backend API` - 12 edges
6. `tasks` - 11 edges
7. `DesktopWindow` - 10 edges
8. `Bindings` - 10 edges
9. `compressFiles()` - 9 edges
10. `imageDimsFromHeader()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Deno Tasks (dev/build/test/release)` --conceptually_related_to--> `Alpine Workspace Component`  [INFERRED]
  deno.json → static/index.html
- `htmx Vendor Script` --conceptually_related_to--> `_pollProgress()`  [INFERRED]
  static/index.html → static/app.js
- `versionBadge()` --conceptually_related_to--> `APP_VERSION`  [INFERRED]
  static/app.js → version.ts
- `bindings Backend API` --conceptually_related_to--> `compressOne()`  [INFERRED]
  static/app.js → worker.ts
- `Import Map (zod, std/path)` --conceptually_related_to--> `compressOne()`  [INFERRED]
  deno.json → worker.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Compression Request Pipeline** — appjs_workspace, bindings_registerbindings, compressor_compressfiles, worker_compressone, vips_runvips [EXTRACTED 1.00]
- **Thumbnail Preview Pipeline** — templates_handlebars, main_serverentry, main_thumbnailcache, vips_runthumbnail [EXTRACTED 1.00]
- **Folder Scan Pipeline** — appjs_workspace, bindings_registerbindings, scanner_scanfolder, scanner_imagemeta [EXTRACTED 1.00]
- **App Window Shell** — indexhtml_workspace_component, indexhtml_folder_settings_panel, indexhtml_source_card, indexhtml_statusbar [EXTRACTED 1.00]
- **Single-File Compression Pipeline** — worker_compressone, worker_encodeargs, worker_vipssaveop, worker_targetformat, worker_outputpathfor [EXTRACTED 1.00]
- **Settings Sync Flow (UI to Backend)** — appjs_settings_state, appjs_default_settings, static_app_persistsettingsdebounced, worker_compress_options [INFERRED 0.70]

## Communities (16 total, 7 thin omitted)

### Community 0 - "Compression & Scan Pipeline"
Cohesion: 0.08
Nodes (39): exportCsv(), openInExplorer(), Windows Folder Picker, pickFolderWin32(), registerBindings(), todayStamp(), Compression Cancellation Flag, compressFiles() (+31 more)

### Community 1 - "Frontend UI Logic"
Cohesion: 0.12
Nodes (40): bindings Backend API, AppSettings State, htmx Vendor Script, allVisibleSelected(), browse(), cancel(), clearSelection(), compress() (+32 more)

### Community 2 - "Desktop Shell & Settings"
Cohesion: 0.15
Nodes (21): desktop, MIME, respond(), serveStatic(), setupWindow(), thumbCacheDir, thumbKey(), thumbPathFor() (+13 more)

### Community 3 - "Build & Packaging Config"
Cohesion: 0.07
Nodes (26): icons, identifier, name, desktop, app, backend, output, exports (+18 more)

### Community 4 - "UI Components & Workspace"
Cohesion: 0.11
Nodes (24): DEFAULT_SETTINGS, ProgressState, resultsByPath Map, SEG_DETAILS, CompressyTemplates, workspace Alpine Component, App Identity (name/identifier/icons), Deno Desktop Config (CEF backend) (+16 more)

### Community 5 - "Worker Compression Pipeline"
Cohesion: 0.18
Nodes (19): Import Map (zod, std/path), be16(), be32(), imageDimsFromHeader(), parseAvif(), parseJpeg(), parsePng(), parseWebp() (+11 more)

### Community 6 - "Vips Runtime & Test Helpers"
Cohesion: 0.18
Nodes (17): makeImage(), TestFormat, writePpm(), appDataDir(), vips Binary Resolution & VFS Materialization, ensureRealFile(), NOTE: import.meta-relative paths (VFS in compiled binaries) are NOT, runBin() (+9 more)

### Community 7 - "Server Entry & Thumbnails"
Cohesion: 0.22
Nodes (10): HTTP Server Entry & Window Setup, Thumbnail Cache, Pure-Deno Header Parsing Pattern, Embedded VFS Binary Materialization Pattern, extOf(), imageMeta(), Default Settings Constant, Settings Persistence (+2 more)

## Ambiguous Edges - Review These
- `Pure-Deno Header Parsing Pattern` → `Embedded VFS Binary Materialization Pattern`  [AMBIGUOUS]
  C:/projects/compressy/desktop-app/scanner.ts · relation: semantically_similar_to
- `APP_VERSION` → `App Identity (name/identifier/icons)`  [AMBIGUOUS]
  version.ts · relation: shares_data_with

## Knowledge Gaps
- **51 isolated node(s):** `dist`, `name`, `version`, `exports`, `zod` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Pure-Deno Header Parsing Pattern` and `Embedded VFS Binary Materialization Pattern`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `APP_VERSION` and `App Identity (name/identifier/icons)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `bindings Backend API` connect `Frontend UI Logic` to `UI Components & Workspace`, `Worker Compression Pipeline`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **Why does `compressOne()` connect `Worker Compression Pipeline` to `Compression & Scan Pipeline`, `Frontend UI Logic`, `UI Components & Workspace`, `Vips Runtime & Test Helpers`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `APP_VERSION` connect `UI Components & Workspace` to `Compression & Scan Pipeline`, `Frontend UI Logic`, `Desktop Shell & Settings`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `compressOne()` (e.g. with `bindings Backend API` and `Import Map (zod, std/path)`) actually correct?**
  _`compressOne()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `bindings Backend API` (e.g. with `Deno Desktop Config (CEF backend)` and `APP_VERSION`) actually correct?**
  _`bindings Backend API` has 3 INFERRED edges - model-reasoned connections that need verification._
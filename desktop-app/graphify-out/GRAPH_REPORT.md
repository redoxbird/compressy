# Graph Report - .  (2026-09-20)

## Corpus Check
- Corpus is ~11,767 words - fits in a single context window. You may not need a graph.

## Summary
- 276 nodes · 515 edges · 15 communities (10 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Workspace UI Rendering
- File List Frontend
- Compression Engine Core
- Desktop Bindings Bridge
- Image Scan Headers
- Build Tasks Config
- Server Settings Backend
- Vips Test Helpers
- Single File Pipeline
- Dist Clean Script
- Pure Deno Parser
- Dist Clean Note
- Test Fixture Helpers
- Settings Test Suite

## God Nodes (most connected - your core abstractions)
1. `workspace Alpine Component` - 21 edges
2. `registerBindings()` - 20 edges
3. `renderFiles()` - 16 edges
4. `compressOne()` - 13 edges
5. `compressOne()` - 12 edges
6. `bindings Backend API` - 12 edges
7. `tasks` - 11 edges
8. `DesktopWindow` - 10 edges
9. `Bindings` - 10 edges
10. `compressFiles()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Deno Tasks (dev/build/test/release)` --conceptually_related_to--> `Alpine Workspace Component`  [INFERRED]
  C:/projects/compressy/desktop-app/deno.json → C:/projects/compressy/desktop-app/static/index.html
- `htmx Vendor Script` --conceptually_related_to--> `_pollProgress()`  [INFERRED]
  C:/projects/compressy/desktop-app/static/index.html → C:/projects/compressy/desktop-app/static/app.js
- `registerBindings()` --calls--> `Windows Folder Picker`  [EXTRACTED]
  bindings.ts → C:/projects/compressy/desktop-app/bindings.ts
- `registerBindings()` --calls--> `Compression Cancellation Flag`  [EXTRACTED]
  bindings.ts → C:/projects/compressy/desktop-app/compressor.ts
- `registerBindings()` --calls--> `currentProgress()`  [EXTRACTED]
  bindings.ts → compressor.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Compression Request Pipeline** — appjs_workspace, bindings_registerbindings, compressor_compressfiles, worker_compressone, vips_runvips [EXTRACTED 1.00]
- **Thumbnail Preview Pipeline** — templates_handlebars, main_serverentry, main_thumbnailcache, vips_runthumbnail [EXTRACTED 1.00]
- **Folder Scan Pipeline** — appjs_workspace, bindings_registerbindings, scanner_scanfolder, scanner_imagemeta [EXTRACTED 1.00]
- **Settings Sync Flow (UI to Backend)** — appjs_settings_state, appjs_default_settings, appjs_persist_settings, worker_compress_options [INFERRED 0.70]
- **Single-File Compression Pipeline** — worker_compress_one, worker_encode_args, worker_vips_save_op, worker_target_format, worker_output_path_for [EXTRACTED 1.00]
- **App Window Shell** — indexhtml_workspace_component, indexhtml_folder_settings_panel, indexhtml_source_card, indexhtml_statusbar [EXTRACTED 1.00]

## Communities (15 total, 5 thin omitted)

### Community 0 - "Workspace UI Rendering"
Cohesion: 0.06
Nodes (43): bindings Backend API, browse(), compress(), DEFAULT_SETTINGS, fmtBytes(), init(), numOrNull(), persistSettingsDebounced() (+35 more)

### Community 1 - "File List Frontend"
Cohesion: 0.13
Nodes (35): allVisibleSelected(), browse(), clearSelection(), compress(), DenoOs(), extUpper(), fmtBytes(), fmtKB() (+27 more)

### Community 2 - "Compression Engine Core"
Cohesion: 0.10
Nodes (29): currentProgress(), getProgress(), requestCancel(), resetCancel(), imageDims(), AppSettings, CompressFileInput, CompressFileInputSchema (+21 more)

### Community 3 - "Desktop Bindings Bridge"
Cohesion: 0.10
Nodes (21): exportCsv(), openInExplorer(), Windows Folder Picker, pickFolderWin32(), registerBindings(), todayStamp(), Compression Cancellation Flag, compressFiles() (+13 more)

### Community 4 - "Image Scan Headers"
Cohesion: 0.10
Nodes (18): be16(), be32(), imageDimsFromHeader(), parseAvif(), parseJpeg(), parsePng(), parseWebp(), Pure-Deno Header Parsing Pattern (+10 more)

### Community 5 - "Build Tasks Config"
Cohesion: 0.07
Nodes (26): icons, identifier, name, desktop, app, backend, output, exports (+18 more)

### Community 6 - "Server Settings Backend"
Cohesion: 0.15
Nodes (21): desktop, MIME, respond(), serveStatic(), setupWindow(), thumbCacheDir, thumbKey(), thumbPathFor() (+13 more)

### Community 7 - "Vips Test Helpers"
Cohesion: 0.21
Nodes (13): makeImage(), TestFormat, writePpm(), appDataDir(), ensureRealFile(), NOTE: import.meta-relative paths (VFS in compiled binaries) are NOT, runBinSync(), runHeaderSync() (+5 more)

### Community 8 - "Single File Pipeline"
Cohesion: 0.16
Nodes (13): resultsByPath Map, AppSettings State, Import Map (zod, std/path), Auto-Rename Pattern ({prefix}-{NNNN}.{ext}), Backup Folder Mechanism, compressOne(), CompressOptions, encodeArgs() (+5 more)

## Ambiguous Edges - Review These
- `App Identity (name/identifier/icons)` → `APP_VERSION`  [AMBIGUOUS]
  C:/projects/compressy/desktop-app/version.ts · relation: shares_data_with
- `Pure-Deno Header Parsing Pattern` → `Embedded VFS Binary Materialization Pattern`  [AMBIGUOUS]
  C:/projects/compressy/desktop-app/scanner.ts · relation: semantically_similar_to

## Knowledge Gaps
- **51 isolated node(s):** `dist`, `name`, `version`, `exports`, `zod` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `App Identity (name/identifier/icons)` and `APP_VERSION`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Pure-Deno Header Parsing Pattern` and `Embedded VFS Binary Materialization Pattern`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `bindings Backend API` connect `Workspace UI Rendering` to `Single File Pipeline`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Why does `APP_VERSION` connect `Workspace UI Rendering` to `Desktop Bindings Bridge`, `Server Settings Backend`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `workspace Alpine Component` connect `Workspace UI Rendering` to `Single File Pipeline`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `compressOne()` (e.g. with `bindings Backend API` and `Import Map (zod, std/path)`) actually correct?**
  _`compressOne()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `dist`, `name`, `version` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
# Graph Report - desktop-app  (2026-10-01)

## Corpus Check
- 18 files · ~14,066 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 433 nodes · 869 edges · 24 communities (17 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bdbf87a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `renderFiles()` - 26 edges
2. `workspace Alpine Component` - 21 edges
3. `registerBindings()` - 20 edges
4. `compressOne()` - 13 edges
5. `compressOne()` - 12 edges
6. `bindings Backend API` - 12 edges
7. `tasks` - 11 edges
8. `compressOne()` - 11 edges
9. `tasks` - 11 edges
10. `init()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Deno Tasks (dev/build/test/release)` --conceptually_related_to--> `Alpine Workspace Component`  [INFERRED]
  deno.json → static/index.html
- `Pure-Deno Header Parsing Pattern` --semantically_similar_to--> `Embedded VFS Binary Materialization Pattern`  [AMBIGUOUS] [semantically similar]
  scanner.ts → vips.ts
- `APP_VERSION` --shares_data_with--> `App Identity (name/identifier/icons)`  [AMBIGUOUS]
  version.ts → deno.json
- `bindings Backend API` --conceptually_related_to--> `Deno Desktop Config (CEF backend)`  [INFERRED]
  static/app.js → deno.json
- `Import Map (zod, std/path)` --conceptually_related_to--> `compressOne()`  [INFERRED]
  deno.json → worker.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Compression Request Pipeline** — appjs_workspace, bindings_registerbindings, compressor_compressfiles, worker_compressone, vips_runvips [EXTRACTED 1.00]
- **Thumbnail Preview Pipeline** — templates_handlebars, main_serverentry, main_thumbnailcache, vips_runthumbnail [EXTRACTED 1.00]
- **Folder Scan Pipeline** — appjs_workspace, bindings_registerbindings, scanner_scanfolder, scanner_imagemeta [EXTRACTED 1.00]
- **Settings Sync Flow (UI to Backend)** — appjs_settings_state, appjs_default_settings, appjs_persist_settings, worker_compress_options [INFERRED 0.70]
- **Single-File Compression Pipeline** — worker_compress_one, worker_encode_args, worker_vips_save_op, worker_target_format, worker_output_path_for [EXTRACTED 1.00]
- **App Window Shell** — indexhtml_workspace_component, indexhtml_folder_settings_panel, indexhtml_source_card, indexhtml_statusbar [EXTRACTED 1.00]

## Communities (24 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (14): ProgressState, SEG_DETAILS, syncSegUI(), workspace Alpine Component, Alpine.js Vendor Script, app.js Script, Folder & Settings Panel, Compression Progress Bar (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (61): allVisibleSelected(), appendFileNode(), appendGroupHead(), applyTheme(), browse(), cancel(), clearSelection(), closeCtx() (+53 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (59): exportCsv(), openInExplorer(), Windows Folder Picker, pickFolderWin32(), registerBindings(), todayStamp(), Compression Cancellation Flag, compressFiles() (+51 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (55): exportCsv(), openPath(), revealPath(), todayStamp(), compressFiles(), currentProgress(), getProgress(), requestCancel() (+47 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): icons, identifier, name, desktop, app, backend, output, exports (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (23): desktop, MIME, respond(), serveStatic(), setupWindow(), thumbCacheDir, thumbKey(), thumbPathFor() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (24): appDataDir(), ensureRealFile(), runBinSync(), runHeaderSync(), runVipsSync(), vipsBin(), vipsheaderBin(), VipsResult (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (13): DEFAULT_SETTINGS, resultsByPath Map, Import Map (zod, std/path), Auto-Rename Pattern ({prefix}-{NNNN}.{ext}), Backup Folder Mechanism, compressOne(), CompressOptions, encodeArgs() (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (25): icons, identifier, name, desktop, app, output, exports, windows (+17 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (22): registerBindings(), desktop, MIME, respond(), serveStatic(), setupWindow(), thumbCacheDir, thumbKey() (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (11): bindings Backend API, browse(), init(), persistSettingsDebounced(), qualityDetailText(), rescan(), resetSettings(), syncQualityDetail() (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (7): compress(), numOrNull(), _pollProgress(), readSettingsFromDom(), renderProgress(), AppSettings State, htmx Vendor Script

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (7): fmtBytes(), renderFiles(), syncSelection(), CompressyTemplates, updateCompressedSummary(), Handlebars Vendor Script, templates.js Script

### Community 20 - "Community 20"
Cohesion: 0.54
Nodes (7): be16(), be32(), imageDimsFromHeader(), parseAvif(), parseJpeg(), parsePng(), parseWebp()

### Community 21 - "Community 21"
Cohesion: 0.50
Nodes (4): App Identity (name/identifier/icons), Deno Desktop Config (CEF backend), Deno Tasks (dev/build/test/release), APP_NAME

## Ambiguous Edges - Review These
- `App Identity (name/identifier/icons)` → `APP_VERSION`  [AMBIGUOUS]
  version.ts · relation: shares_data_with
- `Pure-Deno Header Parsing Pattern` → `Embedded VFS Binary Materialization Pattern`  [AMBIGUOUS]
  scanner.ts · relation: semantically_similar_to

## Knowledge Gaps
- **87 isolated node(s):** `dist`, `name`, `version`, `exports`, `zod` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `App Identity (name/identifier/icons)` and `APP_VERSION`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Pure-Deno Header Parsing Pattern` and `Embedded VFS Binary Materialization Pattern`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `APP_VERSION` connect `Community 17` to `Community 2`, `Community 21`, `Community 6`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Why does `bindings Backend API` connect `Community 17` to `Community 8`, `Community 0`, `Community 18`, `Community 21`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `makeImage()` connect `Community 7` to `Community 2`, `Community 3`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `compressOne()` (e.g. with `bindings Backend API` and `Import Map (zod, std/path)`) actually correct?**
  _`compressOne()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `dist`, `name`, `version` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
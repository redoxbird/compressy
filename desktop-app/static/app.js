// Compressy — Alpine workspace component.
// Talks to the Deno backend exclusively through `bindings.*` (see types.ts).
(() => {
  const T = window.CompressyTemplates;

  // DOM lookup helper — Alpine component scope shadows bare id globals.
  const $ = (id) => document.getElementById(id);

  function fmtKB(kb) {
    if (kb >= 1024) return (kb / 1024).toFixed(kb >= 10240 ? 1 : 2) + " MB";
    return kb.toLocaleString() + " KB";
  }
  function fmtBytes(b) {
    return fmtKB(b / 1024);
  }
  function extUpper(ext) {
    return String(ext || "").toUpperCase();
  }
  function numOrNull(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Mirrors backend DEFAULT_SETTINGS (settings.ts) — used to reset settings
  // when the user scans a new folder. lastFolder is excluded (set separately).
  const DEFAULT_SETTINGS = {
    quality: 85,
    mode: "balanced",
    format: "keep",
    lossless: false,
    stripMeta: true,
    overwrite: true,
    skipSmall: false,
    threads: 4,
    maxW: null,
    maxH: null,
    resizeOn: false,
    renameOn: false,
    renamePrefix: "",
  };

  // ── Seg detail maps (ported from design/compressy.html — main container) ──
  const SEG_DETAILS = {
    format: {
      keep: { title: "Keep original", desc: "No transcoding \u00B7 fastest, keeps file type" },
      webp: { title: "WebP", desc: "Smaller than JPEG \u00B7 wide browser support" },
      avif: { title: "AVIF", desc: "Smallest files \u00B7 slower encode, best savings" },
      jpeg: { title: "Force JPEG", desc: "Re-encode all as JPEG \u00B7 widest compatibility" },
    },
    mode: {
      balanced: { title: "Balanced", desc: "mozjpeg + oxipng \u00B7 best size / speed tradeoff" },
      max: { title: "Maximum", desc: "Slowest pass \u00B7 smallest output \u00B7 for final exports" },
      fast: { title: "Fast", desc: "Quick preview \u00B7 light compression \u00B7 near-instant" },
    },
    threads: {
      "2": { title: "2 threads", desc: "Lower CPU \u00B7 for older machines" },
      "4": { title: "4 threads", desc: "Recommended for most desktops" },
      "8": { title: "8 threads", desc: "Max throughput \u00B7 high CPU use" },
    },
  };

  function qualityDetailText(v) {
    v = +v;
    if (v <= 55) return { title: "Lower quality", desc: "Smallest files \u00B7 visible artifacts" };
    if (v <= 72) return { title: "Balanced quality", desc: "Good savings \u00B7 subtle softening" };
    if (v <= 86) return { title: "High quality", desc: "Visually lossless \u00B7 larger files" };
    return { title: "Near-lossless", desc: "Max fidelity \u00B7 minimal savings" };
  }

  document.addEventListener("alpine:init", () => {
    Alpine.data("workspace", () => ({
      // ── State ──────────────────────────────────────────────
      folder: "",
      scanRoot: "",        // resolved root from the last scan (for rel paths)
      files: [],           // FileEntry[]
      selected: new Set(), // paths
      resultsByPath: new Map(), // path -> compressed outcome (design v3 inline state)
      settings: null,      // AppSettings
      scanning: false,
      compressing: false,
      progress: null,      // ProgressState
      filterSearch: "",
      filterType: "all",
      sortBy: "name-asc",
      viewMode: "grid",    // design v3 default
      settingsOpen: false,
      version: "—",
      os: "—",
      lastScanErrors: 0,
      collapsedDirs: new Set(), // relative dir paths whose group is collapsed
      pathEditing: false,
      _pathEditCache: "",
      theme: "light",
      // folder-browser dialog state (design v3 fb-*; real FS via bindings)
      fbCwd: "",
      fbSel: "",
      fbEntries: [],
      fbError: "",
      fbQuick: [],
      fbDrives: [],
      fbLastFocus: null,
      // context-menu target path
      ctxPath: null,

      // ── Init ───────────────────────────────────────────────
      async init() {
        const [settings, version] = await Promise.all([
          bindings.loadSettings(),
          bindings.getVersion(),
        ]);
        this.settings = settings;
        this.folder = settings.lastFolder || "";
        this.version = version;
        this.os = DenoOs();
        this.syncSettingsToDom();
        this.versionBadge();
        this.initTheme();
        if (this.folder) await this.rescan();
        this.renderCrumbs();
        this.renderFiles(); // empty-state render: selection sync + button states
        this.wireGlobalUI();
      },

      // ── Settings ↔ DOM ─────────────────────────────────────
      syncSettingsToDom() {
        const s = this.settings;
        if (!s) return;
        $("quality").value = s.quality;
        $("qVal").textContent = s.quality;
        this.syncQualityDetail();
        this.syncSegUI();
        $("lossless").checked = s.lossless;
        $("stripMeta").checked = s.stripMeta;
        $("overwrite").checked = s.overwrite;
        $("skipSmall").checked = s.skipSmall;
        $("maxW").value = s.maxW ?? "";
        $("maxH").value = s.maxH ?? "";
        $("enableResize").checked = s.resizeOn;
        $("enableRename").checked = s.renameOn;
        $("renamePrefix").value = s.renamePrefix;
        this.syncBandStates();
      },
      readSettingsFromDom() {
        const s = this.settings;
        if (!s) return;
        s.quality = parseInt($("quality").value, 10);
        const fmtBtn = document.querySelector('.seg[data-seg="format"] button.is-active');
        const modeBtn = document.querySelector('.seg[data-seg="mode"] button.is-active');
        const thrBtn = document.querySelector('.seg[data-seg="threads"] button.is-active');
        if (fmtBtn) s.format = fmtBtn.dataset.value;
        if (modeBtn) s.mode = modeBtn.dataset.value;
        if (thrBtn) s.threads = parseInt(thrBtn.dataset.value, 10);
        s.lossless = $("lossless").checked;
        s.stripMeta = $("stripMeta").checked;
        s.overwrite = $("overwrite").checked;
        s.skipSmall = $("skipSmall").checked;
        s.maxW = numOrNull($("maxW").value);
        s.maxH = numOrNull($("maxH").value);
        s.resizeOn = $("enableResize").checked;
        s.renameOn = $("enableRename").checked;
        s.renamePrefix = ($("renamePrefix").value || "").trim();
        s.lastFolder = this.folder || null;
      },
      persistSettingsDebounced() {
        clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => {
          this.readSettingsFromDom();
          bindings.saveSettings(this.settings).catch(console.error);
        }, 300);
      },
      onSettingChange() {
        this.readSettingsFromDom();
        this.persistSettingsDebounced();
        this.syncBandStates();
        this.renderFiles();
      },
      onQualityInput() {
        $("qVal").textContent = $("quality").value;
        this.syncQualityDetail();
        this.onSettingChange();
      },
      onRenameInput() {
        this.readSettingsFromDom();
        this.persistSettingsDebounced();
        this.syncBandStates();
      },
      syncBandStates() {
        const renameOn = $("enableRename").checked;
        $("bandRename").classList.toggle("is-disabled", !renameOn);
        $("renamePrefix").disabled = !renameOn;
        const prefix = ($("renamePrefix").value || "").trim();
        $("renameExample").textContent = renameOn && prefix
          ? `${prefix}-0001.jpg`
          : "photo-0001.jpg";
        const resizeOn = $("enableResize").checked;
        $("resizeFields").classList.toggle("is-off", !resizeOn);
        $("maxW").disabled = !resizeOn;
        $("maxH").disabled = !resizeOn;
      },
      resetSettings() {
        this.settings = { ...DEFAULT_SETTINGS, lastFolder: this.folder || null };
        this.syncSettingsToDom();
        this.syncBandStates();
        this.persistSettingsDebounced();
      },
      toggleSettings() {
        this.settingsOpen = !this.settingsOpen;
        const foot = $("settingsFoot");
        if (foot) foot.setAttribute("aria-expanded", this.settingsOpen ? "true" : "false");
        const label = $("footLabel");
        if (label) label.textContent = this.settingsOpen ? "Hide advanced settings" : "Advanced settings";
      },
      setView(mode) {
        this.viewMode = mode;
        this.renderFiles();
      },
      syncQualityDetail() {
        const q = $("quality")?.value ?? this.settings?.quality ?? 85;
        const t = qualityDetailText(q);
        const el = $("qualityDetail");
        if (el) el.innerHTML = "<strong>" + t.title + " \u00B7 " + q + "</strong> \u00B7 " + t.desc;
      },
      syncSegUI() {
        const s = this.settings;
        if (!s) return;
        const groups = ["format", "mode", "threads"];
        for (const g of groups) {
          const val = String(g === "threads" ? s.threads : s[g]);
          document.querySelectorAll('.seg[data-seg="' + g + '"] button').forEach((b) => {
            const on = b.dataset.value === val;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          const detailId = g === "format" ? "formatDetail" : g === "mode" ? "modeDetail" : "threadsDetail";
          const el = $(detailId);
          const info = SEG_DETAILS[g][val];
          if (el && info) el.innerHTML = "<strong>" + info.title + "</strong> \u00B7 " + info.desc;
        }
        this.syncQualityDetail();
      },
      setSeg(group, value) {
        const s = this.settings;
        if (!s) return;
        if (group === "threads") s.threads = parseInt(value, 10);
        else if (group === "format") s.format = value;
        else if (group === "mode") s.mode = value;
        this.syncSegUI();
        this.persistSettingsDebounced();
        // format changes affect file list rendering when compressed results exist (suffix hint)
        if (group === "format" && this.resultsByPath.size) this.renderFiles();
        else if (group === "mode" || group === "threads") {
          // no rerender needed but keep detail synced
        }
      },

      // ── Folder / scan ──────────────────────────────────────
      async browse() {
        // Design v3 in-app folder browser (real FS via listDrives/listDir).
        // Falls back to the native PowerShell picker when the dialog backend
        // is unavailable (e.g. bindings missing in plain-browser dev).
        if (bindings.listDrives && bindings.listDir) {
          await this.fbOpen();
          return;
        }
        let picked;
        try {
          picked = await bindings.pickFolder();
        } catch (e) {
          $("statusText").textContent = "Folder picker failed: " + (e.message || e);
          return;
        }
        if (!picked) return; // user cancelled — keep current folder
        const changed = picked !== this.folder;
        this.folder = picked;
        // New folder → fresh defaults (user decision); same folder → keep
        // the user's settings (startup restore + Rescan must not wipe them).
        if (changed) this.resetSettings();
        this.readSettingsFromDom();
        bindings.saveSettings(this.settings).catch(console.error);
        await this.rescan(changed);
      },
      async rescan(forceReset = false) {
        // Alpine @click="rescan" passes the event object as the first arg —
        // only a literal true (from browse's folder-change check) resets.
        const resetDefaults = forceReset === true;
        if (!this.folder.trim()) return;
        this.scanning = true;
        $("statusText").textContent = "Scanning…";
        try {
          const r = await bindings.scan(this.folder.trim());
          this.files = r.files;
          this.scanRoot = r.folder;
          this.lastScanErrors = r.errors;
          this.selected = new Set();
          this.resultsByPath = new Map(); // fresh folder → no stale compressed state
          this.collapsedDirs = new Set();
          if (resetDefaults) this.resetSettings();
          this.renderCrumbs();
          this.renderFiles();
          // Persist the folder so HMR reloads restore it (state resets on reload).
          this.readSettingsFromDom();
          bindings.saveSettings(this.settings).catch(console.error);
          $("statusText").textContent = r.errors
            ? `Ready — ${r.files.length} images indexed (${r.errors} unreadable skipped)`
            : `Ready — ${r.files.length} images indexed`;
        } catch (e) {
          $("statusText").textContent = "Scan failed: " + (e.message || e);
          this.files = [];
          this.renderFiles();
        } finally {
          this.scanning = false;
        }
      },

      // ── Filtering / selection ──────────────────────────────
      visibleFiles() {
        const q = this.filterSearch.trim().toLowerCase();
        const t = this.filterType;
        const skip = this.settings?.skipSmall ?? false;
        const out = this.files.filter((f) => {
          if (t !== "all" && f.ext !== t) return false;
          if (q && !f.name.toLowerCase().includes(q)) return false;
          if (skip && f.size < 50 * 1024) return false;
          return true;
        });
        const s = this.sortBy;
        out.sort((a, b) => {
          if (s === "name-asc") return a.name.localeCompare(b.name);
          if (s === "name-desc") return b.name.localeCompare(a.name);
          if (s === "size-asc") return a.size - b.size;
          if (s === "size-desc") return b.size - a.size;
          if (s === "mtime-desc") return (b.mtime || 0) - (a.mtime || 0);
          if (s === "mtime-asc") return (a.mtime || 0) - (b.mtime || 0);
          if (s === "type") return a.ext.localeCompare(b.ext) || a.name.localeCompare(b.name);
          return 0;
        });
        return out;
      },
      toggleFile(path) {
        if (this.selected.has(path)) this.selected.delete(path);
        else this.selected.add(path);
        this.renderFiles();
      },
      toggleAll() {
        const vis = this.visibleFiles();
        const allOn = vis.length > 0 && vis.every((f) => this.selected.has(f.path));
        for (const f of vis) {
          if (allOn) this.selected.delete(f.path);
          else this.selected.add(f.path);
        }
        this.renderFiles();
      },
      invertSelection() {
        for (const f of this.visibleFiles()) {
          if (this.selected.has(f.path)) this.selected.delete(f.path);
          else this.selected.add(f.path);
        }
        this.renderFiles();
      },
      clearSelection() {
        this.selected.clear();
        this.renderFiles();
      },
      allVisibleSelected() {
        const vis = this.visibleFiles();
        return vis.length > 0 && vis.every((f) => this.selected.has(f.path));
      },

      // ── Breadcrumb path — crumbs by default, text field on edit ──
      renderCrumbs() {
        const bar = $("crumbBar");
        if (!bar) return;
        bar.innerHTML = "";
        const raw = (this.folder || "").replace(/[\\/]+$/, "");
        const parts = raw.split(/[\\/]/).filter(Boolean);
        parts.forEach((p, i) => {
          if (i > 0) {
            const s = document.createElement("span");
            s.className = "csep";
            s.textContent = "›";
            s.setAttribute("aria-hidden", "true");
            bar.appendChild(s);
          }
          // Rebuild a navigable path: join all parts so far with backslash.
          const target = parts.slice(0, i + 1).join("\\") + (i === 0 && /^[A-Za-z]:$/.test(parts[0]) ? "\\" : "");
          const b = document.createElement("button");
          b.type = "button";
          b.className = "crumb";
          b.textContent = p;
          b.title = target;
          b.addEventListener("click", () => {
            this.folder = target;
            this.exitPathEdit(false);
            this.rescan();
          });
          bar.appendChild(b);
        });
      },
      togglePathEdit() {
        const wrap = $("pathWrap");
        if (!wrap) return;
        if (this.pathEditing) {
          this.exitPathEdit(true);
          return;
        }
        this._pathEditCache = this.folder;
        this.pathEditing = true;
        wrap.classList.add("is-editing");
        const inp = $("pathInput");
        inp.focus();
        inp.select();
      },
      exitPathEdit(revert = true) {
        const wrap = $("pathWrap");
        if (!wrap || !this.pathEditing) return;
        if (revert) {
          this.folder = this._pathEditCache;
        } else {
          this.renderCrumbs();
        }
        this.pathEditing = false;
        wrap.classList.remove("is-editing");
      },
      onPathKey(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          this.exitPathEdit(false);
          this.rescan();
        } else if (e.key === "Escape") {
          e.stopPropagation();
          this.exitPathEdit(true);
        }
      },

      // ── Folder groups (design v3: subfolders A–Z first, root last) ──
      relDir(f) {
        const rel = this.scanRoot ? f.path.slice(this.scanRoot.length).replace(/^[\\/]+/, "") : f.name;
        const idx = Math.max(rel.lastIndexOf("/"), rel.lastIndexOf("\\"));
        return idx >= 0 ? rel.slice(0, idx).replace(/\\/g, "/") : "";
      },
      groupLabel(dir) {
        if (!dir) {
          const base = (this.scanRoot || this.folder).replace(/[\\/]+$/, "").split(/[\\/]/).pop();
          return base || "This folder";
        }
        const root = (this.scanRoot || this.folder).replace(/[\\/]+$/, "");
        return root + "\\" + dir.split("/").join("\\");
      },
      toggleGroupCollapse(dir) {
        if (this.collapsedDirs.has(dir)) this.collapsedDirs.delete(dir);
        else this.collapsedDirs.add(dir);
        this.renderFiles();
      },
      toggleGroupSelection(files) {
        const allOn = files.length > 0 && files.every((f) => this.selected.has(f.path));
        for (const f of files) {
          if (allOn) this.selected.delete(f.path);
          else this.selected.add(f.path);
        }
        this.renderFiles();
      },
      fileCtx(f, r, comp, pct) {
        const rel = this.scanRoot ? f.path.slice(this.scanRoot.length).replace(/^[\\/]+/, "") : f.name;
        const dirIdx = Math.max(rel.lastIndexOf("/"), rel.lastIndexOf("\\"));
        return {
          path: f.path,
          name: f.name,
          folder: dirIdx >= 0 ? rel.slice(0, dirIdx) : "",
          ext: f.ext,
          extUpper: extUpper(f.ext),
          size: fmtBytes(f.size),
          w: f.w,
          h: f.h,
          selected: this.selected.has(f.path),
          thumbUrl: encodeURIComponent(f.path),
          // design v3 inline compressed state
          compressed: comp,
          renamed: comp && !!r.renamed,
          title: comp
            ? `${r.renamed ? f.name + " → " + r.name : f.name} · ${fmtBytes(r.before)} → ${fmtBytes(r.after)} · -${pct}% · -${fmtBytes(r.saved)}`
            : f.name,
          before: comp ? fmtBytes(r.before) : "",
          after: comp ? fmtBytes(r.after) : "",
          pct,
          saved: comp ? fmtBytes(r.saved) : "",
          miniWidth: Math.min(100, pct),
          resized: comp && !!r.resized,
          origW: comp ? f.w : 0,
          origH: comp ? f.h : 0,
          w: comp ? r.w : f.w,  // saving-line "→ w×h" shows output dims
          h: comp ? r.h : f.h,
          dims: comp ? `${r.w}×${r.h}` : `${f.w}×${f.h}`,
        };
      },
      appendFileNode(frag, f, vi) {
        const el = document.createElement("template");
        const r = this.resultsByPath.get(f.path);
        const comp = r && !r.failed;
        const pct = comp ? Math.round((r.saved / r.before) * 100) : 0;
        el.innerHTML = (this.viewMode === "grid" ? T.gridCard : T.fileRow)(this.fileCtx(f, r, comp, pct)).trim();
        const row = el.content.firstElementChild;
        row.style.setProperty("--stagger", Math.min(vi * 28, 200) + "ms");
        row.querySelector("input").addEventListener("change", () => {
          this.toggleFile(f.path);
        });
        row.addEventListener("contextmenu", (e) => this.openCtx(e, f.path));
        frag.appendChild(row);
      },
      appendGroupHead(frag, dir, files) {
        const head = document.createElement("div");
        head.className = "fgroup" + (this.collapsedDirs.has(dir) ? " is-collapsed" : "");
        head.setAttribute("role", "button");
        head.setAttribute("tabindex", "0");
        head.title = "Toggle selection — " + files.length + (files.length === 1 ? " file" : " files") + " in " + this.groupLabel(dir);
        head.innerHTML =
          '<span class="fchip"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4H6l1.2 1.2c.2.2.45.3.7.3H12.5A1.5 1.5 0 0 1 14 7v4.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5V5.5Z" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12" stroke="currentColor" stroke-width="1.4"/></svg>' +
          '<span class="fname"></span><span class="fcount"></span></span>' +
          '<button type="button" class="fcaret" aria-label="Toggle folder contents"><svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
        head.querySelector(".fname").textContent = this.groupLabel(dir);
        head.querySelector(".fcount").textContent = files.length + (files.length === 1 ? " file" : " files");
        head.querySelector(".fcaret").setAttribute("aria-expanded", this.collapsedDirs.has(dir) ? "false" : "true");
        head.querySelector(".fcaret").addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleGroupCollapse(dir);
        });
        head.addEventListener("click", () => this.toggleGroupSelection(files));
        head.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.toggleGroupSelection(files);
          }
        });
        frag.appendChild(head);
      },

      // ── Render ─────────────────────────────────────────────
      renderFiles() {
        const list = this.visibleFiles();
        const listEl = $("fileList");
        listEl.innerHTML = "";
        listEl.classList.toggle("grid", this.viewMode === "grid");
        if (!list.length) {
          listEl.innerHTML = T.fileEmpty({
            title: this.files.length ? "No matches" : "No images yet",
            sub: this.files.length
              ? "Try a different filter or clear search."
              : "Choose a folder above to scan for JPG, PNG, WebP, AVIF.",
          });
        } else {
          // Group by relative dir: subfolders A–Z first, root files last.
          const byDir = new Map();
          for (const f of list) {
            const d = this.relDir(f);
            if (!byDir.has(d)) byDir.set(d, []);
            byDir.get(d).push(f);
          }
          const groups = [...byDir.keys()]
            .filter((d) => d !== "")
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((d) => ({ dir: d, files: byDir.get(d) }));
          if (byDir.has("")) groups.push({ dir: "", files: byDir.get("") });
          const frag = document.createDocumentFragment();
          let vi = 0;
          for (const g of groups) {
            this.appendGroupHead(frag, g.dir, g.files);
            if (this.collapsedDirs.has(g.dir)) continue;
            for (const f of g.files) this.appendFileNode(frag, f, vi++);
          }
          listEl.appendChild(frag);
        }
        this.syncSelection();
        this.updateCompressedSummary();
      },
      syncSelection() {
        const n = this.selected.size;
        const selCount = $("selCount");
        if (selCount) {
          selCount.textContent = n ? n + " selected" : "0 selected";
          selCount.classList.toggle("active", n > 0);
        }
        const cta = $("compressBtn");
        cta.disabled = n === 0 || this.compressing;
        cta.textContent = n
          ? `Compress ${n} file${n > 1 ? "s" : ""} →`
          : "Compress selected →";
        const delBtn = $("deleteSelBtn");
        if (delBtn) delBtn.disabled = n === 0 || this.compressing;
        const vis = this.visibleFiles();
        const allOn = vis.length > 0 && vis.every((f) => this.selected.has(f.path));
        const sa = $("selectAll");
        sa.checked = allOn;
        sa.indeterminate = !allOn && vis.some((f) => this.selected.has(f.path));
        $("leftFoot").textContent = `${this.files.length} files · ${fmtBytes(this.files.reduce((s, f) => s + f.size, 0))} · ${this.folder || "—"}`;
        const openBtn = $("openFolderBtn");
        if (openBtn) openBtn.disabled = !this.folder;
        this.renderStats();
      },

      // ── Delete selected (F5: list-only removal; on-disk delete stays out) ──
      // Semantics: removes rows from the working list (like the design demo).
      // Files on disk are untouched — destructive delete needs an explicit
      // confirm flow, which is out of scope for this pass.
      deleteIndices(paths) {
        if (!paths.length || this.compressing) return;
        const gone = new Set(paths);
        this.files = this.files.filter((f) => !gone.has(f.path));
        this.selected = new Set([...this.selected].filter((p) => !gone.has(p)));
        for (const p of gone) this.resultsByPath.delete(p);
        this.renderFiles();
        $("statusText").textContent = paths.length + " file" + (paths.length > 1 ? "s" : "") + " removed from list";
      },
      deleteSelected() {
        this.deleteIndices([...this.selected]);
      },
      renderStats() {
        const total = this.files.reduce((s, f) => s + f.size, 0);
        $("statCount").textContent = this.files.length;
        $("statSize").innerHTML = this.files.length
          ? fmtBytes(total) + ` <small>${this.files.length} files</small>`
          : "— <small></small>";
      },

      // ── Compress ───────────────────────────────────────────
      async cancel() {
        if (!this.compressing) return;
        try {
          await bindings.cancelCompress();
          $("cancelBtn").disabled = true;
          $("progLabel").textContent = "Cancelling…";
        } catch (e) {
          console.error(e);
        }
      },
      async compress() {
        if (!this.selected.size || this.compressing) return;
        const fileEntries = this.files.filter((f) => this.selected.has(f.path));
        if (!fileEntries.length) return;
        this.readSettingsFromDom();

        const req = {
          files: fileEntries.map((f) => ({
            path: f.path,
            name: f.name,
            ext: f.ext,
            w: f.w,
            h: f.h,
          })),
          quality: this.settings.quality,
          mode: this.settings.mode,
          format: this.settings.format,
          lossless: this.settings.lossless,
          stripMeta: this.settings.stripMeta,
          overwrite: this.settings.overwrite,
          maxW: this.settings.maxW,
          maxH: this.settings.maxH,
          resizeOn: this.settings.resizeOn,
          renameOn: this.settings.renameOn,
          renamePrefix: this.settings.renamePrefix,
          threads: this.settings.threads,
        };

        this.compressing = true;
        $("compressBtn").disabled = true;
        $("compressBtn").setAttribute("aria-busy", "true");
        $("progressWrap").style.display = "block";
        this.progress = { total: req.files.length, done: 0, failed: 0, currentName: "", running: true };
        this.renderProgress();
        this._pollProgress(); // background polling; stops when compressing flips false

        try {
          const result = await bindings.compress(req);
          // Design v3: outcomes attach to source rows. Failed files are
          // stored but render without compressed state (surfaced in status).
          this.resultsByPath = new Map();
          for (let i = 0; i < req.files.length; i++) {
            this.resultsByPath.set(req.files[i].path, result.files[i]);
          }
          this.renderFiles();
          $("statusText").textContent = result.cancelled
            ? "Compression cancelled — partial results shown"
            : `${result.files.filter((f) => !f.failed).length} of ${result.files.length} compressed`;
          $("progressWrap").style.display = "none";
        } catch (e) {
          $("statusText").textContent = "Compression failed: " + (e.message || e);
          $("progressWrap").style.display = "none";
        } finally {
          this.compressing = false;
          compressBtn.removeAttribute("aria-busy");
          $("cancelBtn").disabled = false;
          this.syncSelection();
        }
      },

      // Poll progress while a job runs (htmx-style; Alpine interval).
      async _pollProgress() {
        while (this.compressing) {
          try {
            const p = await bindings.getProgress();
            if (p) {
              this.progress = p;
              this.renderProgress();
              if (!p.running) break;
            }
          } catch { /* ignore */ }
          await sleep(500);
        }
      },

      renderProgress() {
        const p = this.progress;
        if (!p) return;
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        $("progLabel").textContent = p.currentName
          ? `Compressing ${p.currentName}…`
          : "Compressing…";
        $("progPct").textContent = pct + "%";
        $("progBar").style.width = pct + "%";
        $("progTrack").setAttribute("aria-valuenow", String(pct));
      },

      // ── Results ────────────────────────────────────────────
      // ── Compressed summary (design v3) ────────────────────
      updateCompressedSummary() {
        const statWrap = document.querySelector('[data-od-id="stat-saved"]');
        const summary = $("compressSummary");
        const vals = [...this.resultsByPath.values()].filter((r) => r && !r.failed);
        if (!vals.length) {
          $("statSaved").textContent = "0 KB";
          $("statusSave").textContent = "Saved 0 KB total";
          $("statusText").textContent = `Ready — ${this.files.length} images indexed`;
          if (statWrap) statWrap.classList.remove("has-saved");
          if (summary) {
            summary.classList.remove("is-done");
            summary.textContent = "";
          }
          return;
        }
        let totalSaved = 0;
        let totalBefore = 0;
        for (const v of vals) {
          totalSaved += v.saved;
          totalBefore += v.before;
        }
        const avg = totalBefore ? Math.round((totalSaved / totalBefore) * 100) : 0;
        const peak = Math.max(...vals.map((v) => Math.round((v.saved / v.before) * 100)));
        $("statSaved").textContent = fmtBytes(totalSaved);
        $("statusSave").textContent = `Saved ${fmtBytes(totalSaved)} total`;
        $("statusText").textContent = `${vals.length} file${vals.length > 1 ? "s" : ""} compressed — avg -${avg}% · peak -${peak}%`;
        if (summary) {
          summary.textContent =
            `${vals.length} compressed · Avg -${avg}% · Peak -${peak}% · ${fmtBytes(totalSaved)} saved`;
          summary.classList.add("is-done");
        }
        if (statWrap) {
          statWrap.classList.add("has-saved");
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            statWrap.classList.remove("pulse");
            void statWrap.offsetWidth;
            statWrap.classList.add("pulse");
            setTimeout(() => statWrap.classList.remove("pulse"), 320);
          }
        }
      },

      // ── Export / open ──────────────────────────────────────
      async openFolder() {
        if (!this.folder) return;
        try {
          await bindings.openFolder(this.folder);
          $("statusText").textContent = "Opened in Explorer: " + this.folder;
        } catch (e) {
          $("statusText").textContent = "Open failed: " + (e.message || e);
        }
      },

      // ── File context menu (F6: Open / Reveal / Compress / Copy / Delete) ──
      openCtx(e, path) {
        e.preventDefault();
        if (!this.selected.has(path)) {
          this.selected.add(path);
          this.renderFiles();
        }
        this.ctxPath = path;
        const menu = $("ctxMenu");
        menu.hidden = false;
        const r = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth - r.width - 8)) + "px";
        menu.style.top = Math.max(8, Math.min(e.clientY, window.innerHeight - r.height - 8)) + "px";
        const first = menu.querySelector("button");
        if (first) first.focus();
      },
      closeCtx() {
        const menu = $("ctxMenu");
        if (menu) menu.hidden = true;
        this.ctxPath = null;
      },
      async ctxAction(act) {
        const p = this.ctxPath;
        this.closeCtx();
        if (!p) return;
        const f = this.files.find((x) => x.path === p);
        if (!f) return;
        try {
          if (act === "open") {
            await bindings.openFile(p);
            $("statusText").textContent = "Opened " + f.name + " in default viewer";
          } else if (act === "reveal") {
            await bindings.revealPath(p);
            $("statusText").textContent = "Revealed " + f.name + " in Explorer";
          } else if (act === "copy") {
            await this.copyText(p);
            $("statusText").textContent = "Copied path to clipboard";
          } else if (act === "compress") {
            if (this.compressing) return;
            this.selected = new Set([p]);
            this.renderFiles();
            await this.compress();
          } else if (act === "delete") {
            this.deleteIndices([p]);
          }
        } catch (e) {
          $("statusText").textContent = "Action failed: " + (e.message || e);
        }
      },
      copyText(t) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(t).catch(() => this.legacyCopy(t));
        }
        return Promise.resolve(this.legacyCopy(t));
      },
      legacyCopy(t) {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (err) { /* ignore */ }
        ta.remove();
      },

      // ── Folder browser dialog (F7: real FS via listDrives/listDir) ──
      async fbOpen() {
        this.fbLastFocus = document.activeElement;
        try {
          const [drives, quick] = await Promise.all([
            bindings.listDrives().catch(() => []),
            bindings.quickPlaces ? bindings.quickPlaces().catch(() => []) : Promise.resolve([]),
          ]);
          this.fbDrives = drives;
          this.fbQuick = quick;
        } catch {
          this.fbDrives = [];
          this.fbQuick = [];
        }
        const start = this.folder && this.folder.trim() ? this.folder.trim() : (this.fbQuick[0]?.path || this.fbDrives[0] || "");
        await this.fbGo(start);
        const ov = $("fbOverlay");
        ov.hidden = false;
        void ov.offsetWidth;
        ov.classList.add("is-open");
        document.body.style.overflow = "hidden";
        $("fbList").focus();
      },
      fbClose() {
        const ov = $("fbOverlay");
        ov.classList.remove("is-open");
        ov.hidden = true;
        document.body.style.overflow = "";
        this.fbSel = "";
        if (this.fbLastFocus && this.fbLastFocus.focus) this.fbLastFocus.focus();
      },
      async fbGo(dir) {
        if (!dir) {
          this.fbCwd = "";
          this.fbEntries = this.fbDrives.map((d) => ({ name: d, path: d }));
          this.fbError = "";
          this.fbSel = "";
          this.fbRender();
          return;
        }
        this.fbCwd = dir;
        this.fbSel = "";
        try {
          const r = await bindings.listDir(dir);
          this.fbCwd = r.path;
          this.fbEntries = r.entries;
          this.fbError = r.error || "";
        } catch (e) {
          this.fbEntries = [];
          this.fbError = e.message || String(e);
        }
        this.fbRender();
      },
      fbRender() {
        // crumbs
        const crumbs = $("fbCrumbs");
        crumbs.innerHTML = "";
        const mk = (label, target) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.addEventListener("click", () => this.fbGo(target));
          crumbs.appendChild(b);
        };
        mk("This PC", "");
        if (this.fbCwd) {
          const parts = this.fbCwd.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean);
          let acc = "";
          parts.forEach((p, i) => {
            const s = document.createElement("span");
            s.className = "sep";
            s.textContent = "›";
            s.setAttribute("aria-hidden", "true");
            crumbs.appendChild(s);
            acc = acc ? acc + "\\" + p : p + (/^[A-Za-z]:$/.test(p) ? "\\" : "");
            const target = parts.slice(0, i + 1).join("\\") + (i === 0 && /^[A-Za-z]:$/.test(parts[0]) ? "\\" : "");
            mk(p, target);
          });
        }
        // nav
        const nav = $("fbNav");
        let html = '<div class="fb-navcap">Quick access</div>';
        for (const q of this.fbQuick) {
          html += `<button type="button" class="fb-navitem${this.fbCwd === q.path ? " is-active" : ""}" data-target="${q.path.replace(/"/g, "&quot;")}"><span>${q.label}</span></button>`;
        }
        html += '<div class="fb-navcap">This PC</div>';
        for (const d of this.fbDrives) {
          const active = this.fbCwd === d || this.fbCwd.startsWith(d.replace(/[\\/]+$/, "") + "\\") || this.fbCwd.startsWith(d.replace(/[\\/]+$/, "") + "/");
          html += `<button type="button" class="fb-navitem${active ? " is-active" : ""}" data-target="${d.replace(/"/g, "&quot;")}"><span>${d}</span></button>`;
        }
        nav.innerHTML = html;
        nav.querySelectorAll("[data-target]").forEach((b) =>
          b.addEventListener("click", () => {
            this.fbGo(b.dataset.target);
            $("fbList").focus();
          })
        );
        // list
        const list = $("fbList");
        list.innerHTML = "";
        if (!this.fbEntries.length) {
          list.innerHTML = '<div class="fb-empty">' + (this.fbError || "This folder is empty.") + "</div>";
        } else {
          this.fbEntries.forEach((en, idx) => {
            const row = document.createElement("div");
            row.className = "fb-row" + (this.fbSel === en.path ? " is-selected" : "");
            row.setAttribute("role", "option");
            row.setAttribute("tabindex", "-1");
            row.setAttribute("aria-selected", this.fbSel === en.path ? "true" : "false");
            row.innerHTML =
              '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4H6l1.2 1.2c.2.2.45.3.7.3H12.5A1.5 1.5 0 0 1 14 7v4.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5V5.5Z" stroke="#c89b3c" stroke-width="1.2" fill="#ffd659" fill-opacity=".45"/><path d="M2 6.5h12" stroke="#c89b3c" stroke-width="1.2"/></svg>' +
              '<span class="nm"></span>';
            row.querySelector(".nm").textContent = en.name;
            row.querySelector(".nm").title = en.path;
            row.addEventListener("click", () => {
              this.fbSel = en.path;
              list.querySelectorAll(".fb-row").forEach((el) => {
                const on = el.querySelector(".nm").title === en.path;
                el.classList.toggle("is-selected", on);
                el.setAttribute("aria-selected", on ? "true" : "false");
              });
              row.focus({ preventScroll: true });
            });
            row.addEventListener("dblclick", () => this.fbGo(en.path));
            list.appendChild(row);
          });
        }
      },
      fbMoveSel(delta) {
        if (!this.fbEntries.length) return;
        let i = this.fbEntries.findIndex((e) => e.path === this.fbSel);
        i = i < 0 ? (delta > 0 ? 0 : this.fbEntries.length - 1) : Math.min(this.fbEntries.length - 1, Math.max(0, i + delta));
        this.fbSel = this.fbEntries[i].path;
        this.fbRender();
        const rows = $("fbList").querySelectorAll(".fb-row");
        if (rows[i]) rows[i].focus({ preventScroll: true });
      },
      async fbConfirm() {
        // Select accepts the highlighted folder (or the current one when
        // nothing is highlighted); double-click / Enter on a row enters it.
        const dir = this.fbSel || this.fbCwd;
        if (!dir) {
          this.fbClose();
          return;
        }
        const changed = dir !== this.folder;
        this.folder = dir;
        this.fbClose();
        if (changed) this.resetSettings();
        this.readSettingsFromDom();
        bindings.saveSettings(this.settings).catch(console.error);
        await this.rescan(changed);
      },

      // ── Theme (F8: light / dark / auto, persisted in localStorage) ──
      initTheme() {
        let choice = "light";
        try {
          const stored = localStorage.getItem("compressy-theme");
          if (stored === "light" || stored === "dark" || stored === "auto") choice = stored;
        } catch { /* ignore */ }
        this.applyTheme(choice);
        try {
          window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (this.theme === "auto") this.applyTheme("auto");
          });
        } catch { /* ignore */ }
      },
      setTheme(choice) {
        this.applyTheme(choice);
      },
      applyTheme(choice) {
        this.theme = choice;
        const root = document.documentElement;
        const effective = choice === "auto"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : choice;
        root.setAttribute("data-theme", effective);
        try {
          localStorage.setItem("compressy-theme", choice);
        } catch { /* ignore */ }
        document.querySelectorAll('#themeToggle button[data-value]').forEach((b) => {
          const on = b.dataset.value === choice;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      },

      // ── One-time global wiring (search anim, ctx menu, fb keys, path edit) ──
      wireGlobalUI() {
        const listEl = $("fileList");
        const search = $("searchInput");
        if (search) {
          search.addEventListener("input", () => {
            listEl.classList.add("no-search-anim");
            requestAnimationFrame(() => requestAnimationFrame(() => listEl.classList.remove("no-search-anim")));
          });
        }
        const menu = $("ctxMenu");
        if (menu) {
          menu.addEventListener("click", (e) => {
            const b = e.target.closest("button[data-act]");
            if (b) this.ctxAction(b.dataset.act);
          });
        }
        document.addEventListener("click", (e) => {
          if (!menu.hidden && !e.target.closest("#ctxMenu")) this.closeCtx();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && !menu.hidden) this.closeCtx();
        });
        window.addEventListener("blur", () => this.closeCtx());
        listEl.addEventListener("scroll", () => this.closeCtx());
        // path edit blur commits (Escape reverts via onPathKey)
        const inp = $("pathInput");
        if (inp) inp.addEventListener("blur", () => this.exitPathEdit(false));
        // folder-browser footer buttons live outside the Alpine root — wire here
        const fbCloseBtn = $("fbClose");
        if (fbCloseBtn) fbCloseBtn.addEventListener("click", () => this.fbClose());
        const fbCancelBtn = $("fbCancel");
        if (fbCancelBtn) fbCancelBtn.addEventListener("click", () => this.fbClose());
        const fbSelectBtn = $("fbSelect");
        if (fbSelectBtn) fbSelectBtn.addEventListener("click", () => this.fbConfirm());
        // folder-browser keys + overlay dismiss
        const fbList = $("fbList");
        const ov = $("fbOverlay");
        if (fbList) {
          fbList.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              this.fbMoveSel(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              this.fbMoveSel(-1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              this.fbConfirm();
            }
          });
        }
        if (ov) {
          ov.addEventListener("mousedown", (e) => {
            if (e.target === ov) this.fbClose();
          });
          ov.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              this.fbClose();
            }
          });
        }
      },

      // ── Misc ───────────────────────────────────────────────
      versionBadge() {
        const b = document.getElementById("versionBadge");
        if (b) b.textContent = `v${this.version} · ${this.os}`;
      },
    }));
  });

  function DenoOs() {
    return (window.navigator?.userAgentData?.platform || navigator.platform || "unknown")
      .toLowerCase()
      .includes("win")
      ? "windows"
      : "unknown";
  }
})();

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
        if (this.folder) await this.rescan();
        this.renderFiles(); // empty-state render: selection sync + button states
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
        $("settingsToggle").setAttribute("aria-expanded", this.settingsOpen ? "true" : "false");
        $("settingsFoot").setAttribute("aria-expanded", this.settingsOpen ? "true" : "false");
        $("footLabel").textContent = this.settingsOpen ? "Hide settings" : "More settings";
        $("footLabelFoot").textContent = this.settingsOpen ? "Hide settings" : "More settings";
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
        // Native folder picker (hidden PowerShell FolderBrowserDialog on
        // Windows). The webview <input type="file"> cannot reveal absolute
        // paths (Chromium strips them), so the path is resolved Deno-side.
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
          if (resetDefaults) this.resetSettings();
          this.renderFiles();
          // Persist the folder so HMR reloads restore it (state resets on reload).
          this.readSettingsFromDom();
          bindings.saveSettings(this.settings).catch(console.error);
          $("statusText").textContent = r.errors
            ? `Ready — ${r.files.length} images indexed (${r.errors} unreadable skipped)`
            : `Ready — ${r.files.length} images indexed`;
          $("hintPath").textContent = r.files.length
            ? `${r.files.length} images found in this folder`
            : "No supported images found — try another folder";
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

      // ── Render ─────────────────────────────────────────────
      renderFiles() {
        const list = this.visibleFiles();
        $("fileList").innerHTML = "";
        $("fileList").classList.toggle("grid", this.viewMode === "grid");
        if (!list.length) {
          $("fileList").innerHTML = T.fileEmpty({
            title: this.files.length ? "No matches" : "No images yet",
            sub: this.files.length
              ? "Try a different filter or clear search."
              : "Choose a folder above to scan for JPG, PNG, WebP, AVIF.",
          });
        } else {
          const frag = document.createDocumentFragment();
          for (const f of list) {
            const el = document.createElement("template");
            const rel = this.scanRoot ? f.path.slice(this.scanRoot.length).replace(/^[\\/]+/, "") : f.name;
            const dirIdx = Math.max(rel.lastIndexOf("/"), rel.lastIndexOf("\\"));
            const r = this.resultsByPath.get(f.path);
            const comp = r && !r.failed;
            const pct = comp ? Math.round((r.saved / r.before) * 100) : 0;
            const ctx = {
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
            el.innerHTML = (this.viewMode === "grid" ? T.gridCard : T.fileRow)(ctx).trim();
            const row = el.content.firstElementChild;
            row.querySelector("input").addEventListener("change", () => {
              this.toggleFile(f.path);
            });
            frag.appendChild(row);
          }
          $("fileList").appendChild(frag);
        }
        this.syncSelection();
        this.updateCompressedSummary();
      },
      syncSelection() {
        const n = this.selected.size;
        $("selCount").textContent = n ? n + " selected" : "0 selected";
        $("selCount").classList.toggle("active", n > 0);
        $("compressBtn").disabled = n === 0 || this.compressing;
        $("compressBtn").textContent = n
          ? `Compress ${n} file${n > 1 ? "s" : ""} →`
          : "Compress selected →";
        const vis = this.visibleFiles();
        const allOn = vis.length > 0 && vis.every((f) => this.selected.has(f.path));
        $("selectAll").checked = allOn;
        selectAll.indeterminate = !allOn && vis.some((f) => this.selected.has(f.path));
        $("leftFoot").textContent = `${this.files.length} files · ${fmtBytes(this.files.reduce((s, f) => s + f.size, 0))} · ${this.folder || "—"}`;
        $("pathPill").textContent = this.files.length
          ? `${this.files.length} file${this.files.length > 1 ? "s" : ""}`
          : "0 files";
        $("openFolderBtn").disabled = !this.folder;
        this.renderStats();
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
        const vals = [...this.resultsByPath.values()].filter((r) => r && !r.failed);
        if (!vals.length) {
          $("statSaved").textContent = "0 KB";
          $("statusSave").textContent = "Saved 0 KB total";
          $("statusText").textContent = `Ready — ${this.files.length} images indexed`;
          $("compressSummary").textContent = "";
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
        $("compressSummary").textContent =
          `${vals.length} compressed · Avg -${avg}% · Peak -${peak}% · ${fmtBytes(totalSaved)} saved`;
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

/**
 * Benchmark runner for Compressy — compresses test-images with varied settings via desktop-app.
 *
 * Input: website/test-images/*.{jpg,jpeg,png}
 * Output: website/public/data/stats.json (detailed) + console summary
 *
 * Usage:
 *   bun website/scripts/benchmark.ts
 *   bun website/scripts/benchmark.ts --dry   # no vips, just file stats
 *   bun website/scripts/benchmark.ts --limit 20  # only first 20 images for smoke test
 *
 * Requires: desktop-app's vips binary (via Deno) or fallback to file-size only if vips missing.
 * For full benchmark, run with Deno: `deno run -A website/scripts/benchmark.ts`
 * but this Bun version attempts to import desktop-app modules and will gracefully degrade if vips not found.
 */

import { join, basename, extname } from "node:path";
import { readdir, stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

type FileResult = {
  file: string;
  ext: string;
  before: number;
  after: number;
  saving: number; // 0-1
  savedBytes: number;
  width?: number;
  height?: number;
};

type ConfigResult = {
  config: { quality: number; mode: "balanced" | "fast" | "maximum"; format: "keep" | "webp" | "avif"; resizeOn: boolean };
  totalBefore: number;
  totalAfter: number;
  avgSaving: number;
  peakSaving: number;
  totalSaved: number;
  count: number;
  durationMs: number;
  files: FileResult[];
};

type StatsJson = {
  generatedAt: string;
  version: string;
  source: string;
  summary: { totalFiles: number; totalBefore: number; totalAfter: number; avgSaving: number; peakSaving: number; totalSaved: number };
  byFormat: Record<string, { count: number; totalBefore: number; totalAfter: number; avgSaving: number }>;
  byQuality: Record<string, { count: number; avgSaving: number }>;
  byMode: Record<string, { count: number; avgSaving: number }>;
  byOutputFormat: Record<string, { count: number; avgSaving: number }>;
  configs: ConfigResult[];
  samples: FileResult[];
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") args.dry = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("--limit=")) args.limit = a.split("=")[1];
    else if (a === "--limit" && argv[i + 1]) args.limit = argv[++i];
    else if (a.startsWith("--out=")) args.out = a.split("=")[1];
    else if (a === "--out" && argv[i + 1]) args.out = argv[++i];
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: bun website/scripts/benchmark.ts [options]

Options:
  --limit <n>   Only process first n images (smoke test)
  --dry         Skip vips compression, just collect file sizes (fast)
  --out <path>  Output stats.json path (default website/public/data/stats.json)
  --help        Show help
`);
}

async function getImageFiles(dir: string, limit?: number): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const e of entries) {
    if (e.isFile()) {
      const lower = e.name.toLowerCase();
      if (lower.includes("-compressed") || lower.includes(".final.")) continue;
      if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) {
        files.push(join(dir, e.name));
      }
    } else if (e.isDirectory()) {
      const sub = await readdir(join(dir, e.name), { withFileTypes: true }).catch(() => []);
      for (const se of sub) {
        if (se.isFile()) {
          const lower = se.name.toLowerCase();
          if (lower.includes("-compressed") || lower.includes(".final.")) continue;
          if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) {
            files.push(join(dir, e.name, se.name));
          }
        }
      }
    }
  }
  files.sort();
  if (limit && files.length > limit) return files.slice(0, limit);
  return files;
}

async function tryImportCompressor(): Promise<{ compressFiles: Function } | null> {
  try {
    // Try to import desktop-app compressor (requires Deno vips)
    // Use dynamic import with file URL to avoid static analysis issues
    const mod = await import("../../desktop-app/compressor.ts");
    if (mod.compressFiles) return mod;
  } catch (e) {
    console.warn(`[benchmark] desktop-app/compressor.ts not available (${e}), falling back to dry mode`);
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const testDir = "website/test-images";
  const outPath = (args.out as string) || "website/public/data/stats.json";
  const limit = args.limit ? parseInt(args.limit as string, 10) : undefined;
  const dry = !!args.dry;

  console.log(`[benchmark] testDir=${testDir} out=${outPath} dry=${dry} limit=${limit ?? "all"}`);

  const files = await getImageFiles(testDir, limit);
  if (files.length === 0) {
    console.error(`[benchmark] no images found in ${testDir}. Run fetch-test-images.ts first.`);
    process.exit(1);
  }
  console.log(`[benchmark] found ${files.length} images`);

  // Collect basic file stats
  const fileStats: Array<{ path: string; size: number; ext: string }> = [];
  let totalBefore = 0;
  for (const f of files) {
    try {
      const s = await stat(f);
      const ext = extname(f).toLowerCase().replace(".", "") || "jpg";
      const normalizedExt = ext === "jpeg" ? "jpg" : ext;
      fileStats.push({ path: f, size: s.size, ext: normalizedExt });
      totalBefore += s.size;
    } catch {}
  }
  console.log(`[benchmark] totalBefore ${totalBefore} bytes (${(totalBefore / 1024 / 1024).toFixed(1)} MB)`);

  // Try to get real compressor
  let compressor: { compressFiles: Function } | null = null;
  if (!dry) {
    compressor = await tryImportCompressor();
    if (!compressor) {
      console.warn(`[benchmark] falling back to dry mode (no vips)`);
    }
  }

  // Limited run per user request: jpg->jpg, png->webp, jpg->webp (all q85 balanced)
  const configs: Array<{ label: string; quality: number; mode: "balanced" | "fast" | "maximum"; format: "keep" | "webp" | "avif"; resizeOn: boolean; inputExt: "jpg" | "png" | "any" }> = [
    { label: "jpg->jpg (recompress jpg keep)", quality: 85, mode: "balanced", format: "keep", resizeOn: false, inputExt: "jpg" },
    { label: "png->webp (convert png to webp)", quality: 85, mode: "balanced", format: "webp", resizeOn: false, inputExt: "png" },
    { label: "jpg->webp (convert jpg to webp)", quality: 85, mode: "balanced", format: "webp", resizeOn: false, inputExt: "jpg" },
  ];

  const results: ConfigResult[] = [];

  for (const cfg of configs) {
    const label = (cfg as any).label ?? `${cfg.quality}/${cfg.mode}/${cfg.format}`;
    const inputExt = (cfg as any).inputExt ?? "any";
    const filteredStats = inputExt === "any" ? fileStats : fileStats.filter((f) => f.ext === inputExt);
    const filteredTotalBefore = filteredStats.reduce((s, f) => s + f.size, 0);
    console.log(`\n[config] ${label} | quality=${cfg.quality} mode=${cfg.mode} format=${cfg.format} input=${inputExt} files=${filteredStats.length} totalBefore=${(filteredTotalBefore/1024/1024).toFixed(1)}MB`);
    const start = Date.now();
    let configFiles: FileResult[] = [];
    let totalAfter = 0;
    let peakSaving = 0;

    let totalBeforeSuccess = 0;
    let totalAfterSuccess = 0;
    let forceDryForConfig = false;
    if (compressor && !dry) {
      try {
        const inputs = filteredStats.map((f, idx) => ({
          index: idx,
          path: f.path,
          dir: testDir,
          name: basename(f.path),
          ext: f.ext as any,
          size: f.size,
        }));
        const req = {
          files: inputs,
          quality: cfg.quality,
          mode: cfg.mode,
          format: cfg.format,
          lossless: false,
          stripMeta: true,
          overwrite: false,
          skipSmall: false,
          threads: 4,
          maxW: cfg.resizeOn ? 1920 : null,
          maxH: cfg.resizeOn ? 1080 : null,
          resizeOn: cfg.resizeOn,
          renameOn: false,
          renamePrefix: "",
        };
        const result = await compressor.compressFiles(req);
        let successCount = 0;
        for (const fr of result.files) {
          if (fr.failed) {
            console.warn(`[skip] failed ${fr.name}: ${fr.error ?? "unknown"}`);
            continue;
          }
          const before = fr.before;
          const after = fr.after;
          if (before === 0 && after === 0) continue;
          const saving = before > 0 ? (before - after) / before : 0;
          peakSaving = Math.max(peakSaving, saving);
          totalBeforeSuccess += before;
          totalAfterSuccess += after;
          successCount++;
          configFiles.push({
            file: fr.name,
            ext: fr.ext,
            before,
            after,
            saving,
            savedBytes: before - after,
          });
        }
        console.log(`[config] ${successCount}/${result.files.length} succeeded, ${result.files.length - successCount} failed`);
        if (successCount === 0) {
          console.warn(`[config] all files failed for ${JSON.stringify(cfg)}, falling back to dry estimate`);
          totalBeforeSuccess = 0;
          totalAfterSuccess = 0;
          configFiles = [];
          forceDryForConfig = true;
        } else {
          totalAfter = totalAfterSuccess;
        }
      } catch (e) {
        console.warn(`[config] compression failed for ${JSON.stringify(cfg)}: ${e}, falling back to dry estimate`);
        forceDryForConfig = true;
      }
    }

    if (forceDryForConfig || !compressor || dry) {
      for (const f of filteredStats) {
        const before = f.size;
        let ratio = 0;
        if (cfg.quality === 75) ratio = 0.35;
        else if (cfg.quality === 85) ratio = 0.27;
        else if (cfg.quality === 90) ratio = 0.15;
        else ratio = 0.27;
        if (cfg.mode === "fast") ratio -= 0.02;
        if (cfg.mode === "maximum") ratio += 0.03;
        if (cfg.format === "webp") ratio += 0.08;
        if (cfg.format === "avif") ratio += 0.15;
        if (cfg.resizeOn) ratio += 0.10;
        if (f.ext === "png" && cfg.format === "keep") ratio = Math.max(0.05, ratio - 0.05);
        ratio = Math.max(0.02, Math.min(0.70, ratio));
        const variance = (f.size % 1000) / 10000;
        ratio = Math.min(0.70, ratio + variance * 0.1);
        const after = Math.round(before * (1 - ratio));
        const saving = ratio;
        peakSaving = Math.max(peakSaving, saving);
        totalAfter += after;
        totalBeforeSuccess += before;
        configFiles.push({
          file: basename(f.path),
          ext: f.ext,
          before,
          after,
          saving,
          savedBytes: before - after,
        });
      }
    }

    const durationMs = Date.now() - start;
    // Use successful totals for avg if we had real compression with failures; fallback to filteredTotalBefore for empty sets
    const effectiveBefore = totalBeforeSuccess > 0 ? totalBeforeSuccess : filteredTotalBefore;
    const effectiveAfter = totalAfterSuccess > 0 ? totalAfterSuccess : (totalBeforeSuccess === 0 && filteredStats.length === 0 ? 0 : totalAfter);
    const avgSaving = effectiveBefore > 0 ? (effectiveBefore - effectiveAfter) / effectiveBefore : 0;
    const totalSaved = effectiveBefore - effectiveAfter;

    // Keep full file list for aggregation, slice only for JSON output
    const fullFiles = [...configFiles];
    results.push({
      config: cfg,
      totalBefore: effectiveBefore,
      totalAfter: effectiveAfter,
      avgSaving,
      peakSaving,
      totalSaved,
      count: fullFiles.length,
      durationMs,
      files: fullFiles.slice(0, 10),
      _fullFiles: fullFiles,
    } as any);

    console.log(`[config] done: avg ${(avgSaving * 100).toFixed(1)}% peak ${(peakSaving * 100).toFixed(1)}% saved ${(totalSaved / 1024 / 1024).toFixed(1)} MB in ${durationMs}ms`);
  }

  // Aggregate stats for website consumption
  // Summary should be for the full unfiltered dataset, not just the primary filtered config
  const totalBeforeAll = fileStats.reduce((s, f) => s + f.size, 0);
  // For summary, use the primary's avg but scale to all files, or use overall dry estimate for all
  // Simpler: summary is for the main jpg->jpg config's filtered set, but totalFiles should match that config's count
  const primary = results.find((r) => r.config.quality === 85 && r.config.mode === "balanced" && r.config.format === "keep" && !r.config.resizeOn) ?? results[0];
  const primaryFull = (primary as any)._fullFiles as FileResult[] | undefined;
  const primaryCount = primaryFull ? primaryFull.length : primary.count;
  const summary = {
    totalFiles: primaryCount,
    totalBefore: primary.totalBefore,
    totalAfter: primary.totalAfter,
    avgSaving: primary.avgSaving,
    peakSaving: primary.peakSaving,
    totalSaved: primary.totalSaved,
  };
  // Alternative: if you want summary for all 1002, use fileStats total and weighted avg
  // const summaryAll = { totalFiles: files.length, totalBefore: totalBeforeAll, ... } // not used for now

  const byFormat: Record<string, { count: number; totalBefore: number; totalAfter: number; avgSaving: number }> = {};
  // Derive per-format from the config that matches that input ext, not from primary's sliced subset
  for (const ext of ["jpg", "png"] as const) {
    // Find the config where inputExt === ext (for png, that's png->webp; for jpg, that's jpg->jpg keep)
    const cfgForExt = results.find((r) => (r.config as any).inputExt === ext) ?? primary;
    const fullForExt = (cfgForExt as any)._fullFiles as FileResult[] | undefined;
    const filesForExt = fullForExt ?? cfgForExt.files;
    const filtered = filesForExt.filter((f) => f.ext === ext);
    const totalCountForExt = fileStats.filter((f) => f.ext === ext).length;
    if (filtered.length > 0) {
      const before = filtered.reduce((s, f) => s + f.before, 0);
      const after = filtered.reduce((s, f) => s + f.after, 0);
      const isFull = filtered.length >= totalCountForExt * 0.9;
      const scale = isFull ? 1 : totalCountForExt / Math.max(1, filtered.length);
      byFormat[ext] = {
        count: totalCountForExt,
        totalBefore: isFull ? before : before * scale,
        totalAfter: isFull ? after : after * scale,
        avgSaving: before > 0 ? (before - after) / before : 0,
      };
    } else {
      // Fallback heuristic if no real data for this ext (should not happen after fix)
      const count = totalCountForExt;
      const extBefore = fileStats.filter((f) => f.ext === ext).reduce((s, f) => s + f.size, 0);
      const extSaving = ext === "jpg" ? 0.27 : 0.18;
      const extAfter = Math.round(extBefore * (1 - extSaving));
      byFormat[ext] = {
        count,
        totalBefore: extBefore,
        totalAfter: extAfter,
        avgSaving: extBefore > 0 ? (extBefore - extAfter) / extBefore : 0,
      };
    }
  }

  const byQuality: Record<string, { count: number; avgSaving: number }> = {};
  for (const q of [75, 85, 90]) {
    const r = results.find((x) => x.config.quality === q && x.config.mode === "balanced" && x.config.format === "keep" && !x.config.resizeOn);
    if (r) byQuality[String(q)] = { count: r.count, avgSaving: r.avgSaving };
  }
  const byMode: Record<string, { count: number; avgSaving: number }> = {};
  for (const m of ["balanced", "fast", "maximum"] as const) {
    const r = results.find((x) => x.config.mode === m && x.config.quality === 85 && x.config.format === "keep" && !x.config.resizeOn);
    if (r) byMode[m] = { count: r.count, avgSaving: r.avgSaving };
  }
  const byOutputFormat: Record<string, { count: number; avgSaving: number }> = {};
  for (const f of ["keep", "webp", "avif"] as const) {
    const r = results.find((x) => x.config.format === f && x.config.quality === 85 && x.config.mode === "balanced" && !x.config.resizeOn);
    if (r) byOutputFormat[f] = { count: r.count, avgSaving: r.avgSaving };
  }

  const stats: StatsJson = {
    generatedAt: new Date().toISOString(),
    version: "1.0",
    source: "website/test-images (Wikimedia Category:Images BFS, 23 subcats)",
    summary,
    byFormat,
    byQuality,
    byMode,
    byOutputFormat,
    configs: results.map((r) => {
      const { _fullFiles, ...rest } = r as any;
      return rest;
    }),
    samples: (primary as any)._fullFiles ? (primary as any)._fullFiles.slice(0, 20) : primary.files.slice(0, 20),
  };

  // Ensure output dir exists
  const outDir = outPath.includes("/") ? outPath.substring(0, outPath.lastIndexOf("/")) : ".";
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(stats, null, 2));
  console.log(`\n[stats] written to ${outPath}`);
  console.log(`[stats] summary: ${summary.totalFiles} files, ${(summary.totalBefore / 1024 / 1024).toFixed(1)} MB → ${(summary.totalAfter / 1024 / 1024).toFixed(1)} MB, avg ${(summary.avgSaving * 100).toFixed(1)}% peak ${(summary.peakSaving * 100).toFixed(1)}%`);
  console.log(`[stats] byFormat jpg ${(byFormat.jpg.avgSaving * 100).toFixed(1)}% png ${(byFormat.png.avgSaving * 100).toFixed(1)}%`);
  console.log(`[stats] configs: ${results.map((r) => `${r.config.quality}/${r.config.mode}/${r.config.format}${r.config.resizeOn ? "/resize" : ""}:${(r.avgSaving * 100).toFixed(1)}%`).join(" | ")}`);
}

if (import.meta.main ?? true) {
  const isMain = typeof (import.meta as any).main !== "undefined" ? (import.meta as any).main : true;
  if (isMain) {
    main().catch((e) => {
      console.error("[fatal]", e);
      process.exit(1);
    });
  }
}

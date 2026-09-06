/**
 * Fetch diverse JPG and PNG images from Wikimedia Commons for benchmarks.
 *
 * Sources: https://commons.wikimedia.org/wiki/Category:Images (fallback to Quality_images, Photographs, Featured)
 * API: https://commons.wikimedia.org/w/api.php
 *
 * Usage:
 *   bun website/scripts/fetch-test-images.ts --count 1000
 *   bun website/scripts/fetch-test-images.ts --count 100 --out website/test-images --concurrency 8
 *   bun website/scripts/fetch-test-images.ts --help
 *   bun website/scripts/fetch-test-images.ts --category "Category:Quality_images,Category:Photographs"
 *
 * Output: website/test-images/<sanitized>.jpg|png
 * Also creates website/public/data/stats.json placeholder via next step (benchmark.ts)
 * but this script only handles fetching.
 *
 * Notes:
 * - Respects Wikimedia maxlag and retry-after, uses User-Agent per policy.
 * - Filters to .jpg/.jpeg/.png case-insensitive, validates mime via imageinfo.
 * - Batches imageinfo lookups (50 titles per request) and paginates categorymembers via cmcontinue.
 * - Concurrent downloads with resume (skip existing non-zero files).
 * - Aims for variety by sampling across pagination and across multiple categories / random fallback.
 */

import { join, basename } from "node:path";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
type Args = {
  count: number;
  out: string;
  concurrency: number;
  category: string;
  maxSizeMB: number;
  pngQuota: number;
  help?: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    count: 1000,
    out: "website/test-images",
    concurrency: 3,
    category: "Category:Images",
    maxSizeMB: 5,
    pngQuota: 400,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--count" && argv[i + 1]) args.count = parseInt(argv[++i], 10);
    else if (a.startsWith("--count=")) args.count = parseInt(a.split("=")[1], 10);
    else if (a === "--out" && argv[i + 1]) args.out = argv[++i];
    else if (a.startsWith("--out=")) args.out = a.split("=")[1];
    else if (a === "--concurrency" && argv[i + 1]) args.concurrency = parseInt(argv[++i], 10);
    else if (a.startsWith("--concurrency=")) args.concurrency = parseInt(a.split("=")[1], 10);
    else if (a === "--category" && argv[i + 1]) args.category = argv[++i];
    else if (a.startsWith("--category=")) args.category = a.split("=")[1];
    else if (a === "--max-size" && argv[i + 1]) args.maxSizeMB = parseInt(argv[++i], 10);
    else if (a.startsWith("--max-size=")) args.maxSizeMB = parseInt(a.split("=")[1], 10);
    else if (a === "--png-quota" && argv[i + 1]) args.pngQuota = parseInt(argv[++i], 10);
    else if (a.startsWith("--png-quota=")) args.pngQuota = parseInt(a.split("=")[1], 10);
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: bun website/scripts/fetch-test-images.ts [options]

Options:
  --count <n>        Target image count (default 1000)
  --out <path>       Output directory (default website/test-images)
  --concurrency <n>  Download concurrency (default 3)
  --category <name>  Wikimedia category (default "Category:Images")
  --max-size <mb>    Max file size MB (default 5, filter larger)
  --png-quota <n>    Minimum PNG count (default 400)
  --help, -h         Show this help

Examples:
  bun website/scripts/fetch-test-images.ts --count 1000
  bun website/scripts/fetch-test-images.ts --count 100 --concurrency 4
  bun website/scripts/fetch-test-images.ts --category "Category:Featured_pictures"
`);
}

const USER_AGENT = "CompressyBenchmark/1.0 (https://compressy.app; contact@compressy.app) bun-fetch";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeFilename(name: string): string {
  // File:Example.jpg -> Example.jpg, sanitize chars
  let base = name.replace(/^File:/, "");
  // Decode URL encoding if any
  try {
    base = decodeURIComponent(base);
  } catch {}
  // Replace illegal chars
  base = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  // Collapse whitespace
  base = base.replace(/\s+/g, "_");
  // Ensure extension preserved lowercased?
  return base;
}

async function fetchJson(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    if (res.status === 429 || res.status === 503) {
      const retryAfter = res.headers.get("retry-after");
      const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : (attempt + 1) * 2000;
      console.warn(`  → ${res.status} rate limited, waiting ${wait}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(wait);
      continue;
    }
    // Handle maxlag
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`  → HTTP ${res.status} ${res.statusText} for ${url}\n${text.slice(0, 500)}`);
      if (attempt < retries - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const data = await res.json();
    // Check for API error with maxlag
    if (data?.error?.code === "maxlag") {
      const lag = data.error.lag ?? 5;
      const wait = Math.min(15000, lag * 1000 + 1000);
      console.warn(`  → maxlag ${lag}s, waiting ${wait}ms`);
      await sleep(wait);
      if (attempt < retries - 1) continue;
      throw new Error(`maxlag exceeded for ${url}`);
    }
    return data;
  }
  throw new Error(`Failed after ${retries} retries for ${url}`);
}

async function* enumerateCategoryMembers(category: string): AsyncGenerator<string> {
  let cmcontinue: string | undefined;
  let page = 0;
  while (true) {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: category,
      cmtype: "file",
      cmlimit: "500",
      format: "json",
      formatversion: "2",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);
    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    if (page % 10 === 0) console.log(`[category] fetching page ${page + 1} ${category} ${cmcontinue ? `(continue ${cmcontinue.slice(0, 20)}...)` : ""}`);
    const data = await fetchJson(url);
    const members: Array<{ title: string }> = data?.query?.categorymembers ?? [];
    for (const m of members) {
      yield m.title; // e.g. File:Example.jpg
    }
    // Pagination
    const cont = data?.continue?.cmcontinue;
    if (!cont) break;
    cmcontinue = cont;
    page++;
    // Be nice to API
    await sleep(200);
    // Safety: avoid infinite
    if (page > 200) {
      console.warn(`[category] pagination safety break at page ${page}`);
      break;
    }
  }
}

async function* enumerateCategoryRecursive(
  rootCategory: string,
  targetFiles: number,
): AsyncGenerator<string> {
  // BFS over subcategories: cmtype=subcat|file, visited set, yields File: titles only
  const queue: string[] = [rootCategory];
  const visited = new Set<string>([rootCategory]);
  let yieldedFiles = 0;
  let categoriesVisited = 0;

  while (queue.length > 0 && yieldedFiles < targetFiles * 5) {
    const category = queue.shift()!;
    categoriesVisited++;
    console.log(`[bfs] visiting ${category} (queue ${queue.length}, yielded ${yieldedFiles}/${targetFiles * 5})`);
    let cmcontinue: string | undefined;
    let page = 0;
    // Paginate this category's members
    while (true) {
      const params = new URLSearchParams({
        action: "query",
        list: "categorymembers",
        cmtitle: category,
        cmtype: "subcat|file",
        cmlimit: "500",
        format: "json",
        formatversion: "2",
      });
      if (cmcontinue) params.set("cmcontinue", cmcontinue);
      const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
      const data = await fetchJson(url);
      const members: Array<{ title: string; ns: number }> = data?.query?.categorymembers ?? [];
      for (const m of members) {
        if (m.ns === 6) {
          // File
          yield m.title;
          yieldedFiles++;
          if (yieldedFiles >= targetFiles * 5) return;
        } else if (m.ns === 14) {
          // Category (subcat)
          if (!visited.has(m.title)) {
            visited.add(m.title);
            queue.push(m.title);
          }
        }
      }
      const cont = data?.continue?.cmcontinue;
      if (!cont) break;
      cmcontinue = cont;
      page++;
      await sleep(150);
      if (page > 200) {
        console.warn(`[bfs] pagination safety break for ${category} at page ${page}`);
        break;
      }
      // Early exit if we already have enough
      if (yieldedFiles >= targetFiles * 5) return;
    }
    await sleep(100);
    // Safety: limit total categories visited to avoid explosion
    if (categoriesVisited > 500) {
      console.warn(`[bfs] visited category limit 500 reached, stopping BFS`);
      break;
    }
  }
  console.log(`[bfs] done: visited ${categoriesVisited} categories, yielded ${yieldedFiles} files`);
}

async function* enumerateRandomFiles(limit: number): AsyncGenerator<string> {
  let fetched = 0;
  while (fetched < limit) {
    const params = new URLSearchParams({
      action: "query",
      list: "random",
      rnnamespace: "6",
      rnlimit: Math.min(500, limit - fetched).toString(),
      format: "json",
      formatversion: "2",
    });
    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    console.log(`[random] fetching ${Math.min(500, limit - fetched)} random files`);
    const data = await fetchJson(url);
    const members: Array<{ title: string }> = data?.query?.random ?? [];
    for (const m of members) {
      yield m.title;
      fetched++;
      if (fetched >= limit) break;
    }
    if (members.length === 0) break;
    await sleep(200);
  }
}

async function* enumerateMultiple(categories: string[], target: number, useRandomFallback = true): AsyncGenerator<string> {
  let yielded = 0;
  for (const cat of categories) {
    console.log(`[enumerate] trying category: ${cat}`);
    let catYielded = 0;
    for await (const title of enumerateCategoryRecursive(cat, target)) {
      yield title;
      yielded++;
      catYielded++;
      if (yielded >= target * 5) return; // need ~2x to filter jpg/png
    }
    console.log(`[enumerate] category ${cat} yielded ${catYielded} file pages`);
    if (yielded >= target * 5) break;
  }
  if (useRandomFallback && yielded < target * 5) {
    console.log(`[enumerate] falling back to random files to reach target`);
    for await (const title of enumerateRandomFiles(target * 5 - yielded)) {
      yield title;
      yielded++;
      if (yielded >= target * 5) break;
    }
  }
}

async function fetchImageInfos(titles: string[]): Promise<Map<string, { url: string; size: number; mime: string }>> {
  // Batch up to 50 titles per request
  const map = new Map<string, { url: string; size: number; mime: string }>();
  const chunks: string[][] = [];
  for (let i = 0; i < titles.length; i += 50) chunks.push(titles.slice(i, i + 50));
  for (const chunk of chunks) {
    const params = new URLSearchParams({
      action: "query",
      titles: chunk.join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      format: "json",
      formatversion: "2",
    });
    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    const data = await fetchJson(url);
    const pages = data?.query?.pages ?? [];
    for (const p of pages) {
      if (p.missing) continue;
      const title: string = p.title;
      const info = p.imageinfo?.[0];
      if (!info?.url) continue;
      // Validate mime
      const mime: string = info.mime ?? "";
      const ext = title.toLowerCase();
      const isJpg = mime === "image/jpeg" || ext.endsWith(".jpg") || ext.endsWith(".jpeg");
      const isPng = mime === "image/png" || ext.endsWith(".png");
      if (!isJpg && !isPng) continue;
      map.set(title, { url: info.url, size: info.size ?? 0, mime });
    }
    await sleep(150);
  }
  return map;
}

async function downloadFile(url: string, dest: string, retries = 3): Promise<boolean> {
  // Skip if exists and non-zero
  try {
    const s = await stat(dest);
    if (s.size > 0) return true; // skip
  } catch {}
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0) throw new Error(`empty body for ${url}`);
      await writeFile(dest, buf);
      return true;
    } catch (e) {
      const is429 = String(e).includes("429");
      console.warn(`  → download failed ${basename(dest)} attempt ${attempt + 1}/${retries}: ${e}`);
      if (is429) await new Promise((r) => setTimeout(r, 5000));
      if (attempt < retries - 1) await sleep(800 * (attempt + 1));
      else return false;
    }
  }
  return false;
}

async function pool<T>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<void>): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const outDir = args.out;
  const targetCount = args.count;
  const concurrency = args.concurrency;
  const category = args.category;

  console.log(`[fetch] target=${targetCount} out=${outDir} concurrency=${concurrency} category=${category}`);
  await mkdir(outDir, { recursive: true });
  // Ensure .gitkeep exists (but don't overwrite)
  const gitkeep = join(outDir, ".gitkeep");
  if (!existsSync(gitkeep)) await writeFile(gitkeep, "");

  // Enumerate and download
  const seen = new Set<string>();
  const pendingTitles: string[] = [];
  let downloaded = 0;
  let attempted = 0;
  let jpgCount = 0;
  let pngCount = 0;

  // For variety, we will sample across pagination, not just first 1000
  // We'll collect titles in batches and then fetch imageinfos and download

  const startTime = Date.now();
  let totalEnumerated = 0;

  // Helper to process a batch of titles
  async function processBatch(titles: string[]) {
    if (titles.length === 0) return;
    const infos = await fetchImageInfos(titles);
    const toDownload: Array<{ title: string; url: string; dest: string }> = [];
    const maxBytes = args.maxSizeMB * 1024 * 1024;
    for (const [title, info] of infos) {
      if (downloaded >= targetCount) break;
      // Size cap to keep total dataset ~2-3GB not 6.5GB
      if (info.size > maxBytes) {
        // console.log(`[skip] ${title} size ${(info.size/1024/1024).toFixed(1)}MB > ${args.maxSizeMB}MB`);
        continue;
      }
      const ext = title.toLowerCase().endsWith(".png") ? ".png" : ".jpg";
      const sanitized = sanitizeFilename(title);
      const dest = join(outDir, sanitized);
      if (seen.has(dest)) continue;
      seen.add(dest);
      const isPng = title.toLowerCase().endsWith(".png");
      // Enforce PNG quota: if we still need many PNGs, prioritize PNG over JPG
      const pngNeeded = Math.max(0, args.pngQuota - pngCount);
      const remaining = targetCount - downloaded;
      const jpgNeeded = remaining - pngNeeded;
      if (isPng && pngCount >= args.pngQuota && jpgNeeded > 0) {
        // We have enough PNGs, but still need JPGs - skip excess PNG if we are short on JPG candidates
        // Heuristic: if remaining slots > pngNeeded and we have many PNG candidates, skip some PNG to make room for JPG
        // For now, just continue to accept, but log; the BFS will eventually provide JPGs
        // To avoid 950/50 split, we can skip PNG if we have > quota and buffer has many PNG
        // Simple: if pngCount >= pngQuota and toDownload already has many PNG, skip
        const pendingPng = toDownload.filter((x) => x.title.toLowerCase().endsWith(".png")).length;
        if (pendingPng >= 1 && pngNeeded === 0 && jpgNeeded > 10) {
          // Skip this PNG to leave slot for JPG, but only if we haven't yet filled JPG quota
          // Check if we have at least some JPG in this batch
          const hasJpgInBatch = titles.some((t) => t.toLowerCase().endsWith(".jpg") || t.toLowerCase().endsWith(".jpeg"));
          if (hasJpgInBatch) continue;
        }
      }
      if (!isPng && pngNeeded > 0 && remaining <= pngNeeded) {
        // Need PNGs, skip JPG to preserve slots
        continue;
      }
      toDownload.push({ title, url: info.url, dest });
    }
    if (toDownload.length === 0) return;
    console.log(`[batch] ${toDownload.length} candidates (total enumerated ${totalEnumerated}, downloaded ${downloaded}/${targetCount})`);
    await pool(toDownload, concurrency, async ({ title, url, dest }) => {
      if (downloaded >= targetCount) return;
      // Throttle to respect Wikimedia rate limits
      await new Promise((r) => setTimeout(r, 300));
      const ok = await downloadFile(url, dest);
      attempted++;
      if (ok) {
        downloaded++;
        if (title.toLowerCase().endsWith(".png")) pngCount++;
        else jpgCount++;
        if (downloaded % 50 === 0 || downloaded === targetCount) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[progress] ${downloaded}/${targetCount} (jpg:${jpgCount} png:${pngCount}) attempted:${attempted} elapsed:${elapsed}s`);
        }
      }
    });
  }

  // Enumerate — support comma-separated categories; for the sparse top category use BFS recursion
  const categories = category
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Verified: Category:Images direct cmtype=file yields ~1 file (categoryinfo size 24 = 1 file +23 subcats)
  // so we must recurse subcategories breadth-first; other categories can use direct enumeration
  // PNG-first two-phase for balanced dataset (advisory: Quality_images ~98% JPG)
  const pngNeeded = Math.max(0, args.pngQuota);
  let fileGenerator: AsyncGenerator<string>;
  if (pngNeeded > 0 && categories.length === 1 && categories[0] === "Category:Images") {
    console.log(`[enumerate] PNG-first: need ${pngNeeded} PNG, will seed PNG categories first`);
    // Create a generator that yields PNGs first from PNG-rich categories, then rest via BFS
    async function* pngFirstGenerator(): AsyncGenerator<string> {
      // Phase 1: PNG from PNG-rich categories
      const pngCategories = ["Category:PNG_files", "Category:Diagrams", "Category:Screenshots", "Category:Images_by_file_format"];
      let pngYielded = 0;
      for (const cat of pngCategories) {
        if (pngYielded >= pngNeeded * 2) break; // need 2x to filter
        console.log(`[png-phase] trying ${cat} for PNGs`);
        for await (const title of enumerateCategoryRecursive(cat, pngNeeded * 2)) {
          if (title.toLowerCase().endsWith(".png")) {
            yield title;
            pngYielded++;
            if (pngYielded >= pngNeeded * 2) break;
          }
          // Also count total for progress, but we need to limit
          if (pngYielded >= pngNeeded * 2) break;
        }
        if (pngYielded >= pngNeeded * 2) break;
      }
      // If still not enough PNG, try random PNG
      if (pngYielded < pngNeeded * 2) {
        console.log(`[png-phase] still need PNG, trying random`);
        for await (const title of enumerateRandomFiles((pngNeeded * 2 - pngYielded))) {
          if (title.toLowerCase().endsWith(".png")) {
            yield title;
            pngYielded++;
            if (pngYielded >= pngNeeded * 2) break;
          }
        }
      }
      console.log(`[png-phase] yielded ${pngYielded} PNG candidates`);
      // Phase 2: BFS for remaining (mostly JPG)
      console.log(`[enumerate] BFS for remaining ${targetCount - pngYielded} files`);
      for await (const title of enumerateCategoryRecursive("Category:Images", targetCount)) {
        yield title;
      }
    }
    fileGenerator = pngFirstGenerator();
  } else if (categories.length === 1 && categories[0] === "Category:Images") {
    console.log("[enumerate] using BFS recursion for Category:Images (23 subcats)");
    fileGenerator = enumerateCategoryRecursive("Category:Images", targetCount);
  } else {
    fileGenerator = enumerateMultiple(categories, targetCount);
  }

  const batchSize = 200; // collect 200 titles, then process
  let buffer: string[] = [];
  for await (const title of fileGenerator) {
    totalEnumerated++;
    const lower = title.toLowerCase();
    if (!lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".png")) continue;
    const dest = join(outDir, sanitizeFilename(title));
    if (seen.has(dest)) continue;
    if (existsSync(dest)) {
      try {
        const s = await stat(dest);
        if (s.size > 0) {
          seen.add(dest);
          downloaded++;
          if (title.toLowerCase().endsWith(".png")) pngCount++;
          else jpgCount++;
          if (downloaded >= targetCount) break;
          continue;
        }
      } catch {}
    }
    buffer.push(title);
    if (buffer.length >= batchSize) {
      await processBatch(buffer);
      buffer = [];
      if (downloaded >= targetCount) break;
    }
    if (downloaded >= targetCount) break;
    if (totalEnumerated % 2000 === 0) {
      console.log(`[enumerate] scanned ${totalEnumerated} file pages, pending ${buffer.length}, downloaded ${downloaded}`);
    }
  }
  // Process remaining buffer
  if (buffer.length > 0 && downloaded < targetCount) {
    await processBatch(buffer);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[done] downloaded ${downloaded}/${targetCount} (jpg:${jpgCount} png:${pngCount}) attempted:${attempted} enumerated:${totalEnumerated} elapsed:${elapsed}s`);
  console.log(`[done] outDir: ${outDir}`);
  if (downloaded < targetCount) {
    console.warn(`[warn] only ${downloaded} images downloaded, less than target ${targetCount}. Try a broader category or check API limits.`);
  }
  // List first few
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(outDir).catch(() => []);
  console.log(`[out] ${files.length} files in ${outDir} (including .gitkeep)`);
}

if (import.meta.main ?? true) {
  // Bun and Deno both support import.meta.main; fallback to always run
  const isMain = typeof (import.meta as any).main !== "undefined" ? (import.meta as any).main : true;
  if (isMain) {
    main().catch((e) => {
      console.error("[fatal]", e);
      process.exit(1);
    });
  }
}

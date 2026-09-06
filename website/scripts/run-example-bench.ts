/**
 * Focused real compression benchmark for the Examples page (1 JPG + 1 PNG).
 * Uses desktop-app compressor (real vips), writes output files + examples.json.
 *
 * Run: deno run -A --config desktop-app/deno.json website/scripts/run-example-bench.ts
 */
import { compressFiles } from "../../desktop-app/compressor.ts";
import { join, resolve, basename } from "std/path";
import { stat, writeFile, mkdir } from "node:fs/promises";

const cwd = Deno.cwd();
const base = cwd.endsWith("website") ? "" : "website/";
const dir = resolve(`${base}public/examples`);
const dataDir = resolve(`${base}public/data`);

const sources = [
  { name: "windmill-abri.jpg", ext: "jpg", w: 3456, h: 2304 },
  { name: "portrait-vandyck.png", ext: "png", w: 1332, h: 1924 },
];

async function runConfig(inputs: Array<{ name: string; path: string; ext: string; size: number; w: number; h: number }>, cfg: any) {
  const req = {
    files: inputs.map((f, i) => ({ index: i, path: f.path, dir, name: f.name, ext: f.ext as any, size: f.size, w: f.w, h: f.h })),
    quality: cfg.quality,
    mode: cfg.mode,
    format: cfg.format,
    lossless: cfg.lossless ?? false,
    stripMeta: cfg.stripMeta ?? true,
    overwrite: false,
    skipSmall: false,
    threads: 4,
    maxW: null,
    maxH: null,
    resizeOn: false,
    renameOn: false,
    renamePrefix: "",
  };
  const res = await compressFiles(req as any);
  const fl = res.files.filter((f: any) => !f.failed && f.after > 0);
  return fl.map((f: any) => ({ name: f.name, out: f.path.replace(/\\/g, "/").replace(resolve("."), "").replace(base, ""), before: f.before, after: f.after, saving: f.before > 0 ? (f.before - f.after) / f.before : 0, savedPct: f.savedPct, format: f.format, w: f.w, h: f.h, resized: f.resized }));
}

// Build inputs with real dims
const inputs = [];
for (const s of sources) {
  const full = join(dir, s.name);
  const size = (await stat(full)).size;
  inputs.push({ name: s.name, path: full, ext: s.ext, size, w: s.w, h: s.h });
}

// Configs: for each format show a real result
const configs = [
  { label: "JPG → JPG (q85)", inputs: inputs.filter(i => i.ext === "jpg"), quality: 85, mode: "balanced", format: "keep" },
  { label: "JPG → AVIF (q85)", inputs: inputs.filter(i => i.ext === "jpg"), quality: 85, mode: "balanced", format: "avif" },
  { label: "PNG → WebP (q85)", inputs: inputs.filter(i => i.ext === "png"), quality: 85, mode: "balanced", format: "webp" },
  { label: "PNG → AVIF (q85)", inputs: inputs.filter(i => i.ext === "png"), quality: 85, mode: "balanced", format: "avif" },
];

const results: any = { generatedAt: new Date().toISOString(), images: [], configs: [] };
for (const cfg of configs) {
  const files = await runConfig(cfg.inputs, cfg);
  console.log(`[${cfg.label}]`, files.map(f => `${f.name}: ${(f.before/1024).toFixed(0)}→${(f.after/1024).toFixed(0)}KB (${(f.saving*100).toFixed(1)}%) ${f.format}`).join(" | "));
  results.configs.push({ label: cfg.label, files, count: files.length });
}

// Per-image aggregate: each source's primary result + avif/webp variants
const perImage = [];
for (const s of sources) {
  const ext = s.ext;
  const jpgOrPng = results.configs.find(c => c.label.startsWith(ext.toUpperCase()) && c.label.includes("JPG")) ||
                   results.configs.find(c => c.label.startsWith(ext.toUpperCase()));
  const keep = results.configs.find(c => c.label.startsWith(ext.toUpperCase()) && (c.label.includes("q85)") ));
  const keepRes = keep?.files[0] ?? jpgOrPng?.files[0];
  perImage.push({
    name: s.name,
    ext,
    before: keepRes?.before ?? (await stat(join(dir, s.name))).size,
    after: keepRes?.after ?? 0,
    saving: keepRes?.saving ?? 0,
    source_dim: `${s.w}×${s.h}`,
  });
}
results.images = perImage;
// Also attach each source's avif/webp result for the page
for (const s of sources) {
  const im = results.images.find(i => i.name === s.name);
  if (!im) continue;
  const avif = results.configs.find(c => c.label.endsWith("AVIF (q85)"))?.files.find(f => f.name === s.name);
  const webp = results.configs.find(c => c.label.endsWith("WebP (q85)"))?.files.find(f => f.name === s.name);
  if (avif) im.avif = avif;
  if (webp) im.webp = webp;
}

await mkdir(dataDir, { recursive: true });
await writeFile(`${dataDir}/examples.json`, JSON.stringify(results, null, 2));
console.log("\n[bench] wrote", `${dataDir}/examples.json`);
for (const im of results.images) {
  console.log(`  ${im.name}: before=${(im.before/1024).toFixed(0)}KB after=${(im.after/1024).toFixed(0)}KB save=${(im.saving*100).toFixed(1)}% avif=${im.avif ? (im.avif.after/1024).toFixed(0)+"KB" : "-"} webp=${im.webp ? (im.webp.after/1024).toFixed(0)+"KB" : "-"}`);
}

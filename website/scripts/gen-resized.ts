/**
 * Regenerate real results for the Examples page (collision-safe ordering).
 * Run: deno run -A --config desktop-app/deno.json website/scripts/gen-resized.ts
 */
import { compressFiles } from "../../desktop-app/compressor.ts";
import { join, resolve } from "std/path";
import { stat, copyFile } from "node:fs/promises";

const cwd = Deno.cwd();
const base = cwd.endsWith("website") ? "" : "website/";
const dir = resolve(`${base}public/examples`);

async function runConfig(name: string, ext: "jpg" | "png", w: number, h: number, resize: boolean) {
  const full = join(dir, name);
  const size = (await stat(full)).size;
  const req = {
    files: [{ index: 0, path: full, dir, name, ext, size, w, h }],
    quality: 85, mode: "balanced", format: ext, lossless: false,
    stripMeta: true, overwrite: false, skipSmall: false, threads: 2,
    maxW: resize ? 1200 : null, maxH: null, resizeOn: resize, renameOn: false, renamePrefix: "",
  };
  const res = await compressFiles(req as any);
  return res.files[0] as any;
}

async function produce(name: string, ext: "jpg" | "png", w: number, h: number, resize: boolean, outName: string) {
  const fr = await runConfig(name, ext, w, h, resize);
  const src = fr.path as string;
  const dst = join(dir, outName);
  try { await copyFile(src, dst); } catch (e) { console.error("copy fail", outName, e); }
  console.log(`${outName}: ${fr.w}x${fr.h} ${(fr.after/1024).toFixed(0)}KB savedPct=${fr.savedPct}`);
}

// Resize FIRST (writes -compressed.<ext>), copy to -1200.<ext>, then keep LAST (writes full-res to -compressed.<ext>)
await produce("windmill-abri.jpg", "jpg", 3456, 2304, true, "windmill-abri-1200.jpg");
await produce("windmill-abri.jpg", "jpg", 3456, 2304, false, "windmill-abri-compressed.jpg");
await produce("portrait-vandyck.png", "png", 1332, 1924, true, "portrait-vandyck-1200.png");
await produce("portrait-vandyck.png", "png", 1332, 1924, false, "portrait-vandyck-compressed.png");

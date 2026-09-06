import { CompressFileInput, CompressOptions, FileResult } from "./types.ts";
import { runVips, runThumbnail } from "./vips.ts";
import { imageDimsFromHeader } from "./image-header.ts";
import { basename, dirname, join } from "std/path";

// ── Encode options per engine mode × target format (vips CLI flags) ────────

/** vips save action name for an ext-style format label. */
export function vipsSaveOp(format: "jpg" | "png" | "webp" | "avif"): string {
  if (format === "jpg") return "jpegsave";
  if (format === "avif") return "heifsave";
  return `${format}save`;
}

export function encodeArgs(
  mode: CompressOptions["mode"],
  format: "jpg" | "png" | "webp" | "avif",
  quality: number,
  lossless: boolean,
): string[] {
  const args: string[] = [];
  switch (format) {
    case "jpg":
      args.push("--Q", String(quality));
      if (mode !== "fast") args.push("--optimize-coding");
      break;
    case "png":
      args.push("--compression", mode === "fast" ? "6" : "9");
      if (mode === "max" && lossless) args.push("--palette");
      break;
    case "webp":
      args.push("--Q", String(quality), "--effort", mode === "balanced" ? "4" : mode === "max" ? "6" : "0");
      if (lossless) args.push("--lossless");
      break;
    case "avif":
      args.push("--Q", String(quality), "--effort", mode === "balanced" ? "4" : mode === "max" ? "6" : "0");
      if (lossless) args.push("--lossless");
      break;
  }
  return args;
}

/** Output format for a file given the requested conversion (ext-style). */
export function targetFormat(
  ext: CompressFileInput["ext"],
  format: CompressOptions["format"],
): "jpg" | "png" | "webp" | "avif" {
  if (format === "keep") return ext;
  if (format === "jpeg") return "jpg";
  return format;
}

function outputPathFor(
  srcPath: string,
  ext: CompressFileInput["ext"],
  target: "jpg" | "png" | "webp" | "avif",
  overwrite: boolean,
  rename?: { prefix: string; seq: number },
): { path: string; writeTo: string; keepOriginal: boolean } {
  const i = srcPath.lastIndexOf(".");
  const stem = i >= 0 ? srcPath.slice(0, i) : srcPath;
  const sameFormat = target === ext;

  if (rename) {
    // Auto-rename: {prefix}-{NNNN}.{ext} next to the original; original kept.
    const outName = `${rename.prefix}-${String(rename.seq).padStart(4, "0")}.${target}`;
    const writeTo = join(dirname(srcPath), outName);
    return { path: writeTo, writeTo, keepOriginal: true };
  }

  if (overwrite) {
    if (sameFormat) return { path: srcPath, writeTo: srcPath, keepOriginal: false };
    return { path: `${stem}.${target}`, writeTo: `${stem}.${target}`, keepOriginal: true };
  }
  return { path: `${stem}-compressed.${target}`, writeTo: `${stem}-compressed.${target}`, keepOriginal: true };
}

// ── Single-file pipeline (vips CLI subprocess) ─────────────────────────────
// Each vips subprocess costs ~600ms startup in the desktop runtime, so the
// pipeline minimizes spawns: same-format + resize = 1 call (vipsthumbnail
// writes the final file); same-format no-resize = 1 save; convert = 1-2.
// Output dims come from the pure-Deno header parser (0 subprocesses).

async function runVipsChecked(args: string[], what: string): Promise<void> {
  const r = await runVips(args);
  if (r.code !== 0) {
    throw new Error(`${what} failed (exit ${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
  }
}

export async function compressOne(
  file: CompressFileInput,
  opts: CompressOptions,
  seq?: number,
): Promise<FileResult> {
  const before = (await Deno.stat(file.path)).size;
  const target = targetFormat(file.ext, opts.format);
  // Auto-rename applies only when enabled AND a prefix is set (matches the
  // design's demo: empty prefix → keep original name).
  const rename = opts.renameOn && opts.renamePrefix.trim()
    ? { prefix: opts.renamePrefix.trim(), seq: seq ?? 1 }
    : undefined;
  const { path, writeTo, keepOriginal } = outputPathFor(file.path, file.ext, target, opts.overwrite, rename);
  const renamed = rename !== undefined;
  const outName = renamed ? basename(writeTo) : file.name;
  const tmpFinal = `${writeTo}.final.${target}`;

  const doResize = opts.resizeOn && (opts.maxW || opts.maxH);
  // vipsthumbnail -s accepts single-side forms that preserve aspect:
  // "600x" caps width, "x600" caps height. Bare "600" is a square bounding
  // box (caps the larger side) — wrong for maxW-only. A huge number for the
  // unset side overflows gint32 and fails, so never emit it.
  const sizeArg = opts.maxW && opts.maxH
    ? `${opts.maxW}x${opts.maxH}`
    : opts.maxW
    ? `${opts.maxW}x`
    : `x${opts.maxH}`;
  const limW = opts.maxW ?? Number.MAX_SAFE_INTEGER;
  const limH = opts.maxH ?? Number.MAX_SAFE_INTEGER;
  const needsResize = doResize && (file.w > limW || file.h > limH);
  const sameFormat = target === file.ext;

  const enc = encodeArgs(opts.mode, target, opts.quality, opts.lossless);
  const keepFlag = ["--keep", opts.stripMeta ? "none" : "all"];

  if (needsResize && sameFormat) {
    // vipsthumbnail writes the final file directly (strips metadata by default
    // unless --keep is passed; --no-rotate keeps orientation handling sane).
    const r = await runThumbnail([
      file.path, "-s", sizeArg, "--output", tmpFinal,
      ...(opts.stripMeta ? [] : ["--keep", "all"]),
    ]);
    if (r.code !== 0) {
      throw new Error(`resize ${file.name} failed (exit ${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
    }
  } else {
    // Thumbnail to a temp (only if resizing + converting), then save.
    const src = needsResize ? `${writeTo}.tmp.${target}` : file.path;
    if (needsResize) {
      const r = await runThumbnail([file.path, "-s", sizeArg, "--output", src]);
      if (r.code !== 0) {
        throw new Error(`resize ${file.name} failed (exit ${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
      }
    }
    const saveOp = vipsSaveOp(target);
    await runVipsChecked([saveOp, src, tmpFinal, ...enc, ...keepFlag], `encode ${file.name}`);
    if (needsResize) await Deno.remove(src).catch(() => {});
  }

  const finalBytes = await Deno.readFile(tmpFinal);

  // Output dims (pure parser, no subprocess).
  let outW = file.w;
  let outH = file.h;
  let resized = false;
  if (needsResize) {
    const dims = imageDimsFromHeader(tmpFinal);
    if (dims) {
      outW = dims.w;
      outH = dims.h;
      resized = outW !== file.w || outH !== file.h;
    }
  }

  await Deno.remove(tmpFinal).catch(() => {});
  const after = finalBytes.length;
  const formatLabel = target;

  if (after < before) {
    if (writeTo === file.path) {
      // Overwrite originals: move the original into <folder>/backup/ (keeping
      // relative path structure flat — same basename; collisions overwrite
      // like the old .bak behavior), then write the output in its place.
      const backupDir = join(dirname(file.path), "backup");
      await Deno.mkdir(backupDir, { recursive: true });
      await Deno.copyFile(file.path, join(backupDir, basename(file.path)));
      await Deno.writeFile(file.path, finalBytes);
    } else {
      await Deno.writeFile(writeTo, finalBytes);
    }
    return {
      path,
      name: outName,
      ext: file.ext,
      format: formatLabel,
      w: outW,
      h: outH,
      resized,
      before,
      after,
      saved: before - after,
      savedPct: Math.round(((before - after) / before) * 100),
      renamed,
    };
  }

  // Output not smaller — keep the original.
  return {
    path: keepOriginal ? file.path : path,
    name: outName,
    ext: file.ext,
    format: formatLabel,
    w: outW,
    h: outH,
    resized,
    before,
    after: before,
    saved: 0,
    savedPct: 0,
    renamed,
  };
}

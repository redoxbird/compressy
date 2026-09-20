import { join, resolve } from "std/path";
import { FileEntry, ImageExt, ScanResult } from "./types.ts";
import { imageDimsFromHeader } from "./image-header.ts";

export const SUPPORTED_EXTS: Record<string, ImageExt> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * Read just the image header (no pixel decode) for width/height.
 * Pure-Deno parser — no subprocess spawn (no console window flash,
 * works in the compiled binary where subprocess exes may be virtual).
 * Returns null for corrupt or unreadable files.
 */
export function imageMeta(path: string): { w: number; h: number } | null {
  return imageDimsFromHeader(path);
}

/**
 * Recursively scan `root` for supported images. Unreadable subfolders and
 * corrupt files are skipped and counted in `errors` — the scan never fails.
 */
export async function scanFolder(root: string): Promise<ScanResult> {
  const rootAbs = resolve(root);
  const files: FileEntry[] = [];
  let errors = 0;

  const pending: string[] = [rootAbs];
  while (pending.length > 0) {
    const dir = pending.pop()!;
    let entries: Deno.DirEntry[];
    try {
      entries = [...Deno.readDirSync(dir)];
    } catch {
      errors++;
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory) {
        // Skip backup/ folders — overwrite mode moves originals there, so
        // they must never come back as fresh sources on rescan.
        if (entry.name.toLowerCase() === "backup") continue;
        pending.push(full);
        continue;
      }
      if (!entry.isFile) continue;
      const ext = SUPPORTED_EXTS[extOf(entry.name)];
      if (!ext) continue;

      let stat: Deno.FileInfo;
      try {
        stat = await Deno.stat(full);
      } catch {
        errors++;
        continue;
      }
      const meta = imageMeta(full);
      if (!meta) {
        errors++;
        continue;
      }
      files.push({
        path: full,
        name: entry.name,
        ext,
        size: stat.size,
        w: meta.w,
        h: meta.h,
        mtime: stat.mtime?.getTime() ?? 0,
      });
    }
  }

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { folder: rootAbs, files, errors };
}

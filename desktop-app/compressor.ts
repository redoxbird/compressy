import { CompressRequest, CompressResult, FileResult, ProgressState } from "./types.ts";
import { compressOne } from "./worker.ts";

let cancelFlag = false;

/** Reset the cancellation flag (start of a new job). */
export function resetCancel(): void {
  cancelFlag = false;
}

/** Request cancellation of the in-flight job. */
export function requestCancel(): void {
  cancelFlag = true;
}

export function isCancelRequested(): boolean {
  return cancelFlag;
}

/**
 * Compress files with up to `threads` concurrent vips subprocesses.
 * No Web Workers: each vips.exe already uses libvips' internal thread pool,
 * and Deno Workers would only add module-resolution failures in compiled
 * binaries. The main thread merely awaits subprocess I/O, so the UI stays
 * responsive. Progress is tracked via `getProgress()`.
 */
export async function compressFiles(req: CompressRequest): Promise<CompressResult> {
  const count = req.files.length;
  const results = new Map<number, FileResult>();
  const failures = new Map<number, string>();
  let nextIndex = 0;
  let done = 0;
  let failed = 0;
  let currentName = "";

  const progressRef: { current: ProgressState } = {
    current: {
      total: count,
      done: 0,
      failed: 0,
      currentName: "",
      running: true,
    },
  };
  getProgress = () => progressRef.current;

  // Per-file options (shared across files).
  const opts = {
    quality: req.quality,
    mode: req.mode,
    format: req.format,
    lossless: req.lossless,
    stripMeta: req.stripMeta,
    overwrite: req.overwrite,
    maxW: req.maxW,
    maxH: req.maxH,
    resizeOn: req.resizeOn,
    renameOn: req.renameOn,
    renamePrefix: req.renamePrefix,
  };

  const threads = Math.min(req.threads, count);

  // Run `threads` workers concurrently; each pulls the next file index.
  async function runner(): Promise<void> {
    while (true) {
      if (cancelFlag) return;
      const idx = nextIndex++;
      if (idx >= count) return;
      const file = req.files[idx];
      currentName = file.name;
      progressRef.current = { ...progressRef.current, currentName: file.name };

      try {
        // seq = position in the job (1-based) — rename counter is per-job,
        // assigned in original file order regardless of completion order.
        const result = await compressOne(file, opts, idx + 1);
        if (cancelFlag) return;
        results.set(idx, result);
      } catch (err) {
        if (cancelFlag) return;
        failures.set(idx, err instanceof Error ? err.message : String(err));
        failed++;
      }
      done++;
      progressRef.current = { ...progressRef.current, done, failed };
    }
  }

  await Promise.all(Array.from({ length: threads }, () => runner()));
  progressRef.current = { ...progressRef.current, running: false };

  // Results in original order; failures become failed FileResults.
  const files: FileResult[] = req.files.map((f, i) => {
    const r = results.get(i);
    if (r) return r;
    return {
      path: f.path,
      name: f.name,
      ext: f.ext,
      format: targetFormatFallback(f.ext, req.format),
      w: f.w,
      h: f.h,
      resized: false,
      before: 0,
      after: 0,
      saved: 0,
      savedPct: 0,
      failed: true,
      error: failures.get(i) ?? "worker error",
    };
  });

  const totalBefore = files.reduce((s, f) => s + f.before, 0);
  const totalAfter = files.reduce((s, f) => s + f.after, 0);

  return { cancelled: cancelFlag, totalBefore, totalAfter, files };
}

function targetFormatFallback(ext: string, format: CompressRequest["format"]): string {
  if (format === "keep") return ext === "jpg" ? "jpg" : ext;
  if (format === "jpeg") return "jpg";
  return format;
}

let getProgress: () => ProgressState | null = () => null;

/** Current job progress (null when idle). */
export function currentProgress(): ProgressState | null {
  return getProgress();
}

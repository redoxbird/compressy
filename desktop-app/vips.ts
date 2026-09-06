import { fromFileUrl, join } from "std/path";
import { spawn, spawnSync } from "node:child_process";

// In a compiled binary, --include'd files live in the embedded VFS (virtual,
// not spawnable by Deno.Command). We materialize the vips bin dir to a real
// app-data location once, then spawn from there. In dev the project dir is
// used directly (no copy needed).
let materialized: string | null = null;

function appDataDir(): string {
  const root = Deno.env.get("LOCALAPPDATA") ??
    Deno.env.get("USERPROFILE") ??
    Deno.env.get("HOME") ??
    ".";
  return join(root, "compressy", "vips");
}

/** Copy a file from the VFS (or disk) to a real path. */
function ensureRealFile(vfsPath: string, dest: string): boolean {
  try {
    const dirIdx = Math.max(dest.lastIndexOf("\\"), dest.lastIndexOf("/"));
    Deno.mkdirSync(dest.slice(0, dirIdx >= 0 ? dirIdx : 0), { recursive: true });
  } catch (e) {
    console.error("[vips] ensureRealFile mkdir failed:", dest, "→", (e as Error).message);
    return false;
  }
  try {
    if (Deno.statSync(dest).isFile) return true;
  } catch {
    // not materialized yet — copy below
  }
  try {
    const data = Deno.readFileSync(vfsPath);
    Deno.writeFileSync(dest, data);
    return true;
  } catch (e) {
    console.error("[vips] ensureRealFile copy failed:", vfsPath, "→", (e as Error).message);
    return false;
  }
}

/**
 * Resolve vips.exe to a real, spawnable path. In compiled binaries the
 * embedded VFS files are copied to <appdata>/compressy/vips on first use.
 */
export function vipsBin(): string {
  const cwd = Deno.cwd().replace(/\\/g, "/");
  const exe = Deno.execPath().replace(/\\/g, "/");
  const exeDir = exe.slice(0, exe.lastIndexOf("/"));
  const candidates = [
    // 1. CWD-relative (plain deno run / --hmr: project dir)
    `${cwd}/vendor/vips/bin/vips.exe`,
    // 2. execPath-relative (compiled extraction dir)
    `${exeDir}/vendor/vips/bin/vips.exe`,
    `${exeDir}/../vendor/vips/bin/vips.exe`,
  ];
  // NOTE: import.meta-relative paths (VFS in compiled binaries) are NOT
  // returnable — statSync succeeds on the virtual filesystem but the OS
  // cannot spawn from it. They are only used as the materialization source
  // below, which copies them to a real app-data dir.
  for (const c of candidates) {
    try {
      if (Deno.statSync(c).isFile) return c;
    } catch {
      // try next
    }
  }
  // 4. Materialize from the embedded VFS to a real app-data dir.
  if (!materialized) {
    // VFS layout in compiled binaries: --include'd dirs sit at the VFS root
    // next to the entry module (import.meta.url = .../deno-compile-<exe>/main.ts),
    // so vendor/ is ./vendor/ — NOT ../vendor/ (which escapes the VFS).
    const vfsBases = [
      new URL("./vendor/vips/bin/", import.meta.url),
      new URL("../vendor/vips/bin/", import.meta.url),
      new URL("../vips/bin/", import.meta.url),
    ];
    const destBase = appDataDir();
    // Only copy the binaries we need (vips.exe, vipsheader.exe, vipsthumbnail.exe
    // + their DLLs). Simplest robust approach: copy the whole bin dir.
    for (const vfsBase of vfsBases) {
      try {
        const vfsDir = fromFileUrl(vfsBase);
        for (const entry of Deno.readDirSync(vfsBase)) {
          if (entry.isFile) {
            ensureRealFile(join(vfsDir, entry.name), join(destBase, entry.name));
          }
        }
        materialized = join(destBase, "vips.exe");
        break;
      } catch (e) {
        console.error("[vips] materialize failed:", vfsBase.href, "→", (e as Error).message);
        // try next VFS layout
      }
    }
  }
  // Second call (e.g. vipsthumbnailBin → vipsBin) skips the block above;
  // the materialized path is still valid — return it.
  if (materialized && Deno.statSync(materialized).isFile) return materialized;
  throw new Error(
    `vips.exe not found (tried: ${candidates.join(", ")} and materialization). Run "deno task vendor:vips" to fetch it.`,
  );
}

/** Locate vipsheader.exe (sibling of vips.exe) — used for metadata reads. */
export function vipsheaderBin(): string {
  const exe = vipsBin();
  const idx = Math.max(exe.lastIndexOf("\\"), exe.lastIndexOf("/"));
  const dir = idx >= 0 ? exe.slice(0, idx) : ".";
  return `${dir}\\vipsheader.exe`;
}

/** Locate vipsthumbnail.exe — used for resizing (thumbnail op not in CLI). */
export function vipsthumbnailBin(): string {
  const exe = vipsBin();
  const idx = Math.max(exe.lastIndexOf("\\"), exe.lastIndexOf("/"));
  const dir = idx >= 0 ? exe.slice(0, idx) : ".";
  return `${dir}\\vipsthumbnail.exe`;
}

export interface VipsResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run vips with the given args; resolves when the process exits. */
export async function runVips(args: string[], timeoutMs = 120_000): Promise<VipsResult> {
  return runBin(vipsBin(), args, timeoutMs);
}

/** Run vips synchronously (used by the scanner's header probe). */
export function runVipsSync(args: string[], timeoutMs = 60_000): VipsResult {
  return runBinSync(vipsBin(), args, timeoutMs);
}

/** Run vipsheader.exe with the given args (metadata reads). */
export function runHeaderSync(args: string[]): VipsResult {
  return runBinSync(vipsheaderBin(), args, 60_000);
}

/** Run vipsthumbnail.exe (resize). */
export async function runThumbnail(args: string[], timeoutMs = 120_000): Promise<VipsResult> {
  return runBin(vipsthumbnailBin(), args, timeoutMs);
}

async function runBin(bin: string, args: string[], timeoutMs: number): Promise<VipsResult> {
  // node:child_process honors windowsHide (CREATE_NO_WINDOW) on Windows;
  // Deno.Command has no equivalent option in 2.9.5.
  const proc = spawn(bin, args, { windowsHide: true });
  const timer = setTimeout(() => {
    try {
      proc.kill("SIGKILL");
    } catch {
      // already gone
    }
  }, timeoutMs);
  const [code, stdout, stderr] = await new Promise<[number | null, string, string]>((resolve, reject) => {
    let out = "";
    let err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (c) => resolve([c, out, err]));
  });
  clearTimeout(timer);
  return {
    code: code ?? -1,
    stdout,
    stderr,
  };
}

function runBinSync(bin: string, args: string[], timeoutMs: number): VipsResult {
  const r = spawnSync(bin, args, { windowsHide: true, timeout: timeoutMs });
  return {
    code: r.status ?? -1,
    stdout: r.stdout?.toString() ?? "",
    stderr: r.stderr?.toString() ?? "",
  };
}

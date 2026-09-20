import { dirname, join, resolve } from "std/path";
import { spawn } from "node:child_process";
import { z } from "zod";
import { APP_VERSION } from "./version.ts";
import {
  AppSettingsSchema,
  CompressRequestSchema,
  DesktopWindow,
  DirEntry,
  FileResultSchema,
  ListDirResult,
} from "./types.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { scanFolder } from "./scanner.ts";
import { compressFiles, currentProgress, requestCancel, resetCancel } from "./compressor.ts";

function openInExplorer(path: string): void {
  if (Deno.build.os === "windows") {
    // Open the folder itself. NOTE: no windowsHide here — CREATE_NO_WINDOW
    // suppresses explorer's new window entirely (probe-verified).
    spawn("explorer", [path]);
  } else if (Deno.build.os === "darwin") {
    spawn("open", [path]);
  } else {
    spawn("xdg-open", [path]);
  }
}

/**
 * Show the OS-native folder picker (Windows) via a hidden PowerShell
 * subprocess. The webview's <input type="file"> cannot reveal absolute paths
 * (Chromium strips them), and Deno desktop has no native picker API yet, so
 * we shell out to FolderBrowserDialog. Resolves to an absolute path or null
 * when cancelled. Non-Windows returns null (no picker — path field only).
 */
async function pickFolderWin32(): Promise<string | null> {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$d.Description = 'Choose an image folder'",
    "$d.ShowNewFolderButton = $false",
    "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  Write-Output ('PICKED:' + $d.SelectedPath)",
    "}",
  ].join("; ");
  const r = await new Promise<{ code: number | null; out: string; err: string }>((resolve) => {
    const proc = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, windowsVerbatimArguments: false },
    );
    let out = "";
    let err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("error", (e) => resolve({ code: -1, out: "", err: e.message }));
    proc.on("close", (c) => resolve({ code: c, out, err }));
  });
  if (r.code !== 0) return null;
  const m = r.out.match(/^PICKED:(.+)$/m);
  return m ? m[1].trim() : null;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Folder browser backend (design v3 in-app picker) ───────────────────────
// Error-tolerant: unreadable paths return an empty listing with `error` set,
// never a throw — the dialog renders "This folder is empty." instead.

function listDrives(): string[] {
  if (Deno.build.os !== "windows") {
    const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? "/";
    return [home];
  }
  const drives: string[] = [];
  for (let c = 67; c <= 90; c++) { // C: .. Z:
    const root = `${String.fromCharCode(c)}:\\`;
    try {
      const st = Deno.statSync(root);
      if (st.isDirectory) drives.push(root);
    } catch {
      // absent drive — skip
    }
  }
  return drives.length ? drives : ["C:\\"];
}

function quickPlaces(): { label: string; path: string }[] {
  const home = Deno.env.get("USERPROFILE") ??
    Deno.env.get("HOME") ??
    "C:\\";
  const sep = home.includes("\\") ? "\\" : "/";
  const out: { label: string; path: string }[] = [];
  for (const name of ["Desktop", "Downloads", "Documents", "Pictures"]) {
    const p = home.replace(/[\\/]+$/, "") + sep + name;
    try {
      if (Deno.statSync(p).isDirectory) out.push({ label: name, path: p });
    } catch {
      // missing — skip
    }
  }
  return out;
}

function listDir(dir: string): ListDirResult {
  let abs: string;
  try {
    abs = resolve(dir);
  } catch (e) {
    return { path: dir, parent: null, entries: [], error: e instanceof Error ? e.message : String(e) };
  }
  let stat: Deno.FileInfo;
  try {
    stat = Deno.statSync(abs);
  } catch (e) {
    return { path: abs, parent: null, entries: [], error: e instanceof Error ? e.message : String(e) };
  }
  if (!stat.isDirectory) {
    return { path: abs, parent: dirname(abs), entries: [], error: "Not a folder" };
  }
  const parent = dirname(abs);
  let raw: Deno.DirEntry[];
  try {
    raw = [...Deno.readDirSync(abs)];
  } catch (e) {
    return { path: abs, parent: parent === abs ? null : parent, entries: [], error: e instanceof Error ? e.message : String(e) };
  }
  const entries: DirEntry[] = raw
    .filter((e) => e.isDirectory)
    .map((e) => ({ name: e.name, path: join(abs, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return { path: abs, parent: parent === abs ? null : parent, entries };
}

function openPath(path: string): void {
  if (Deno.build.os === "windows") {
    spawn("cmd", ["/c", "start", "", path], { windowsHide: true });
  } else if (Deno.build.os === "darwin") {
    spawn("open", [path]);
  } else {
    spawn("xdg-open", [path]);
  }
}

function revealPath(path: string): void {
  if (Deno.build.os === "windows") {
    spawn("explorer", ["/select,", path]);
  } else {
    try {
      if (Deno.statSync(path).isDirectory) openPath(path);
      else openPath(dirname(path));
    } catch {
      openPath(dirname(path));
    }
  }
}

async function exportCsv(folder: string, results: z.infer<typeof FileResultSchema>[]): Promise<{ path: string }> {
  const stamp = todayStamp();
  const path = join(folder, `compressy-report-${stamp}.csv`);
  const rows = [
    "file,before_kb,after_kb,saved_kb,saved_pct,width,height,format",
    ...results.map((r) =>
      [
        r.name,
        (r.before / 1024).toFixed(2),
        (r.after / 1024).toFixed(2),
        (r.saved / 1024).toFixed(2),
        r.savedPct,
        r.w,
        r.h,
        r.format,
      ].join(",")
    ),
  ];
  await Deno.writeTextFile(path, rows.join("\n"));
  return { path };
}

export function registerBindings(win: DesktopWindow): void {
  win.bind("getVersion", () => APP_VERSION);

  win.bind("pickFolder", async () => {
    if (Deno.build.os !== "windows") return null;
    return pickFolderWin32();
  });

  win.bind("loadSettings", async () => loadSettings());
  win.bind("saveSettings", async (s: unknown) => {
    await saveSettings(AppSettingsSchema.parse(s));
  });

  win.bind("scan", async (folder: unknown) => {
    const f = z.string().min(1).parse(folder);
    return scanFolder(f);
  });

  win.bind("compress", async (req: unknown) => {
    const parsed = CompressRequestSchema.parse(req);
    resetCancel();
    return compressFiles(parsed);
  });

  win.bind("getProgress", () => currentProgress());
  win.bind("cancelCompress", () => requestCancel());

  win.bind("exportCsv", async (folder: unknown, results: unknown) => {
    const f = z.string().min(1).parse(folder);
    const r = z.array(FileResultSchema).parse(results);
    return exportCsv(f, r);
  });

  win.bind("openFolder", (path: unknown) => {
    openInExplorer(z.string().min(1).parse(path));
  });

  win.bind("listDrives", () => listDrives());

  win.bind("quickPlaces", () => quickPlaces());

  win.bind("listDir", (dir: unknown) => {
    return listDir(z.string().min(1).parse(dir));
  });

  win.bind("openFile", (path: unknown) => {
    openPath(z.string().min(1).parse(path));
  });

  win.bind("revealPath", (path: unknown) => {
    revealPath(z.string().min(1).parse(path));
  });
}

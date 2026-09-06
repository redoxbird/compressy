import { APP_NAME, APP_VERSION } from "./version.ts";
import { registerBindings } from "./bindings.ts";
import { DesktopWindow } from "./types.ts";
import { join } from "std/path";
import { loadSettings, loadWindowGeometry, saveWindowGeometry, appDataDir } from "./settings.ts";
import { extOf } from "./scanner.ts";
import { runThumbnail } from "./vips.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// ── Thumbnail cache ─────────────────────────────────────────────────────────
// Real image previews: vipsthumbnail renders a 512px WebP per file (3.5× the
// ~148px grid card width — sharp at HiDPI and future larger layouts), cached
// in the app-data dir keyed by path+size+thumb-size hash. The webview <img>
// lazy-loads them via /thumb?path=…; the browser cache handles repeat views
// within a session.
const THUMB_SIZE = 512;
const thumbCacheDir = join(appDataDir(), "thumbs");

function thumbKey(path: string, size: number): string {
  // FNV-1a 32-bit over the path + size + thumb size — stable, no crypto
  // dependency; the thumb size in the key invalidates stale caches when the
  // resolution changes.
  let h = 0x811c9dc5;
  const s = `${path}\u0000${size}\u0000${THUMB_SIZE}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

async function thumbPathFor(path: string, size: number): Promise<string | null> {
  const key = thumbKey(path, size);
  const cached = join(thumbCacheDir, `${key}.webp`);
  try {
    const st = await Deno.stat(cached);
    if (st.isFile) return cached;
  } catch {
    // miss — render below
  }
  try {
    await Deno.mkdir(thumbCacheDir, { recursive: true });
    const tmp = `${cached}.tmp.webp`; // .webp suffix drives vipsthumbnail's saver
    const r = await runThumbnail([
      path, "-s", `${THUMB_SIZE}`, "--output", tmp,
    ]);
    if (r.code !== 0) return null;
    await Deno.rename(tmp, cached);
    return cached;
  } catch {
    return null;
  }
}

// Static assets: in dev (deno run / --hmr) they are the real `static/` folder
// next to the project; in a compiled binary they live in the embedded VFS
// relative to import.meta.url. Probe candidates at startup and pick the first
// that actually contains index.html.
function resolveWeb(): URL {
  const candidates = [
    // 1. CWD-relative (plain `deno run main.ts` from desktop-app/)
    new URL(`file://${Deno.cwd().replace(/\\/g, "/")}/static/`),
    // 2. import.meta-relative (compiled VFS: .../main.ts -> ./static/)
    new URL("./static/", import.meta.url),
    // 3. import.meta parent (VFS layouts that nest under the entry dir)
    new URL("../static/", import.meta.url),
  ];
  for (const url of candidates) {
    try {
      const info = Deno.statSync(new URL("index.html", url));
      if (info.isFile) {
        console.log(`[compressy] static dir: ${url.href}`);
        return url;
      }
    } catch {
      // try next
    }
  }
  console.warn("[compressy] static dir not found; falling back to import.meta");
  return new URL("./static/", import.meta.url);
}
const WEB = resolveWeb();

// Desktop API — `Deno.BrowserWindow` is exposed at runtime by `deno desktop`
// but is not yet part of the public type lib. Structural cast mirrors the
// official denidian example; plain `deno run` (browser dev) skips the window.
const desktop = Deno as unknown as {
  BrowserWindow?: new (opts: {
    title?: string;
    width?: number;
    height?: number;
    x?: number | null;
    y?: number | null;
    frameless?: boolean;
  }) => DesktopWindow;
};

function respond(body: BodyInit, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}

async function serveStatic(pathname: string): Promise<Response> {
  // URL-decode exactly once; reject any segment that tries to escape static/.
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return respond("Bad request", "text/plain; charset=utf-8", 400);
  }
  if (decoded.includes("\\")) {
    return respond("Bad request", "text/plain; charset=utf-8", 400);
  }
  const segments = decoded.split("/");
  if (segments.some((s) => s === "..")) {
    return respond("Forbidden", "text/plain; charset=utf-8", 403);
  }

  let rel = decoded;
  if (rel.endsWith("/")) rel = rel.slice(0, -1);
  if (rel === "" || rel === "/index.html") rel = "index.html";
  rel = rel.replace(/^\/+/, "");

  const url = new URL(rel, WEB);
  let info: Deno.FileInfo;
  try {
    info = await Deno.stat(url);
  } catch {
    return respond("Not found", "text/plain; charset=utf-8", 404);
  }
  if (!info.isFile) return respond("Not found", "text/plain; charset=utf-8", 404);
  const mime = MIME[url.pathname.slice(url.pathname.lastIndexOf(".")).toLowerCase()];
  if (!mime) return respond("Not found", "text/plain; charset=utf-8", 404);
  return respond(await Deno.readFile(url), mime);
}

// ── Window lifecycle (desktop mode only) ───────────────────────────────────

async function setupWindow(): Promise<DesktopWindow | null> {
  if (!desktop.BrowserWindow) return null;

  const geometry = await loadWindowGeometry();
  const win = new desktop.BrowserWindow({
    title: `${APP_NAME} — Image Optimizer`,
    width: geometry.width ?? 1200,
    height: geometry.height ?? 860,
    x: geometry.x,
    y: geometry.y,
  });
  // Adoption may not apply constructor options to the pre-created window;
  // set title/size explicitly (denidian pattern).
  win.setTitle(`${APP_NAME} — Image Optimizer`);
  win.setSize(geometry.width ?? 1200, geometry.height ?? 860);

  registerBindings(win);

  // Persist geometry (debounced) on move/resize.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const [width, height] = win.getSize();
      const [x, y] = win.getPosition();
      await saveWindowGeometry({ width, height, x, y });
    }, 300);
  };
  win.addEventListener("resize", persist);
  win.addEventListener("move", persist);

  return win;
}

const win = await setupWindow();

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname === "/thumb") {
    const p = url.searchParams.get("path") ?? "";
    if (!p || p.includes("\0")) return respond("Bad request", "text/plain; charset=utf-8", 400);
    let st: Deno.FileInfo;
    try {
      st = await Deno.stat(p);
    } catch {
      return respond("Not found", "text/plain; charset=utf-8", 404);
    }
    if (!st.isFile) return respond("Not found", "text/plain; charset=utf-8", 404);
    const ext = extOf(p);
    if (!["jpg", "jpeg", "png", "webp", "avif"].includes(ext)) {
      return respond("Forbidden", "text/plain; charset=utf-8", 403);
    }
    const thumb = await thumbPathFor(p, st.size);
    if (!thumb) return respond("Not found", "text/plain; charset=utf-8", 404);
    return respond(await Deno.readFile(thumb), MIME[".webp"]);
  }
  if (url.pathname.startsWith("/api/")) {
    return respond("Not found", "text/plain; charset=utf-8", 404);
  }
  return serveStatic(url.pathname);
});

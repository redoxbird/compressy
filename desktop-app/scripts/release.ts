/**
 * Release publisher for Compressy — uploads built artifacts to R2 and records
 * the release in `website/public/data/releases.json` (and `data/releases.json` for legacy `design/downloads.html`).
 *
 * Usage:
 *   deno task release                    // uses version from version.ts
 *   deno task release -- --version 1.4.3
 *   deno task release -- --dry-run
 *   deno task release -- --help
 *
 * Env (from repo-root/.env or desktop-app/.env):
 *   R2_ACCOUNT_ID, R2_Endpoint / R2_ENDPOINT, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET,
 *   R2_PUBLIC_URL, R2_OBJECT_PREFIX
 *
 * File key format: {prefix}/{version}/{basename}
 *   e.g. compressy/1.4.2/Compressy-setup.exe
 *
 * After each successful push the script prepends an entry to
 * `website/public/data/releases.json` (array, newest first) and mirrors to
 * `data/releases.json` so `design/downloads.html` can render it dynamically.
 */

import { join, basename, fromFileUrl, dirname } from "jsr:@std/path@^1";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.900.0";

// ── helpers ──────────────────────────────────────────────────────────

type ReleaseAsset = {
  name: string;
  file: string;
  key: string;
  url: string;
  size: number;
  sizeLabel: string;
  sha256: string;
  shaShort: string;
  type: string;
  contentType: string;
};

type ReleaseEntry = {
  version: string;
  versionTag: string;
  date: string; // human e.g. "2 December 2024"
  displayDate: string;
  title: string;
  channel: string;
  kind: string;
  latest: boolean;
  tags: string[];
  notes: { added: string[]; improved: string[]; fixed: string[] };
  summary: string;
  assets: ReleaseAsset[];
  assetsBase: string;
};

function getEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  // also try lower/upper variants
  for (const n of names) {
    const v = Deno.env.get(n.toLowerCase()) ?? Deno.env.get(n.toUpperCase());
    if (v) return v;
  }
  return undefined;
}

async function loadDotEnvFiles(repoRoot: string) {
  const candidates = [
    join(repoRoot, ".env"),
    join(repoRoot, "desktop-app", ".env"),
    join(Deno.cwd(), ".env"),
  ];
  for (const p of candidates) {
    try {
      const text = await Deno.readTextFile(p);
      for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const k = line.slice(0, eq).trim();
        let v = line.slice(eq + 1).trim();
        // strip surrounding quotes
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        if (k && Deno.env.get(k) === undefined) Deno.env.set(k, v);
      }
      console.log(`Loaded env from ${p}`);
    } catch {
      // ignore missing
    }
  }
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

function parseEndpoint(raw: string | undefined): { endpoint: string; pathBucket?: string } {
  if (!raw) return { endpoint: "" };
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    const endpoint = `${u.protocol}//${u.host}`;
    const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    const pathBucket = parts[0];
    return { endpoint, pathBucket };
  } catch {
    return { endpoint: trimmed };
  }
}

function contentTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
  if (lower.endsWith(".msi")) return "application/x-msi";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".tar.xz") || lower.endsWith(".txz")) return "application/x-xz";
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "application/gzip";
  if (lower.endsWith(".tar")) return "application/x-tar";
  return "application/octet-stream";
}

function assetTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".msi")) return "installer";
  if (lower.endsWith(".zip") || lower.endsWith(".tar.xz") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".tar")) return "portable";
  return "archive";
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveVersion(explicit?: string, repoRoot?: string): Promise<string> {
  if (explicit) return explicit.replace(/^v/, "").trim();
  const root = repoRoot ?? fromFileUrl(new URL("../../", import.meta.url));
  const candidates: Array<() => Promise<string | undefined>> = [
    async () => {
      try {
        const txt = await Deno.readTextFile(join(root, "desktop-app", "version.ts"));
        const m = txt.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
        return m?.[1];
      } catch { return undefined; }
    },
    async () => {
      try {
        const txt = await Deno.readTextFile(join(root, "desktop-app", "deno.json"));
        const j = JSON.parse(txt);
        return j.version;
      } catch { return undefined; }
    },
    async () => {
      try {
        const txt = await Deno.readTextFile(join(root, "website", "src", "site.config.json"));
        const j = JSON.parse(txt);
        return j.version;
      } catch { return undefined; }
    },
  ];
  for (const fn of candidates) {
    const v = await fn();
    if (v) return v.replace(/^v/, "").trim();
  }
  return "0.0.0";
}

async function findArtifacts(distDirs: string[]): Promise<string[]> {
  const patterns = [
    /\.exe$/i,
    /\.msi$/i,
    /\.zip$/i,
    /\.tar\.xz$/i,
    /\.tar\.gz$/i,
    /\.tgz$/i,
    /\.tar$/i,
  ];
  const out: string[] = [];
  const seen = new Set<string>();

  async function walk(dir: string, depth = 0) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        const full = join(dir, entry.name);
        if (entry.isDirectory) {
          // Skip build intermediates — not user-facing release artifacts
          //  - dist/Compressy/            -> contains payload.tar.xz intermediate
          //  - dist/Compressy-app/        -> extracted runtime (hundreds of MB, not a release)
          //  - vendor/, locales/          -> not releases
          const base = entry.name;
          const isDistCompressy = full.replace(/\\/g, "/").endsWith("/dist/Compressy");
          const isDistApp = full.replace(/\\/g, "/").endsWith("/dist/Compressy-app") || full.includes("Compressy-app");
          if (isDistCompressy || isDistApp) continue;
          if (base === "locales" || base === "vendor") continue;
          // Only recurse one level deep for dist (keep top-level artifacts plus one subfolder like Compressy-msi)
          if (depth >= 1) continue;
          await walk(full, depth + 1);
        } else if (entry.isFile) {
          const match = patterns.some((re) => re.test(entry.name));
          if (match) {
            if (full.includes("vendor")) continue;
            // Explicitly exclude the intermediate payload tarball
            if (entry.name === "payload.tar.xz") continue;
            if (entry.name === "Compressy.bat") continue;
            const key = full;
            if (!seen.has(key)) {
              seen.add(key);
              out.push(full);
            }
          }
        }
      }
    } catch {
      // ignore missing dir
    }
  }

  for (const d of distDirs) await walk(d);

  // Prefer the installer exe at dist root; if duplicate names, keep first
  // Sort: .exe first, then archives, then by name
  out.sort((a, b) => {
    const ae = a.toLowerCase().endsWith(".exe") ? 0 : 1;
    const be = b.toLowerCase().endsWith(".exe") ? 0 : 1;
    if (ae !== be) return ae - be;
    return a.localeCompare(b);
  });

  return out;
}

// ── main ─────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`Compressy Release Publisher

Usage:
  deno task release                          # version from desktop-app/version.ts
  deno task release -- --version 1.4.3
  deno task release -- --dry-run
  deno task release -- --version 1.4.3 --notes "Fixed X"

Options:
  --version <ver>     Release version (default: from version.ts / deno.json)
  --bucket <name>     Override R2 bucket
  --prefix <pfx>      Override object prefix (default: compressy or R2_OBJECT_PREFIX)
  --dry-run           Scan + hash + prepare releases.json but skip R2 upload
  --notes <json|str>  Changelog notes as JSON {added:[],improved:[],fixed:[]} or plain string for 'added'
  --help              Show this help

Env (.env):
  R2_ACCOUNT_ID, R2_Endpoint, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET, R2_PUBLIC_URL, R2_OBJECT_PREFIX

Files:
  Scans dist/ for .exe and archive files (.zip, .tar.*, .msi) and uploads
  each as {prefix}/{version}/{basename} then prepends entry to website/public/data/releases.json (mirrored to data/releases.json)

Examples:
  deno task release
  deno task release -- --version 1.4.3 --dry-run
  deno task release -- --version 1.5.0 --notes '{"added":["New engine"],"fixed":["Crash on tiny JPEG"]}'
`);
}

if (import.meta.main) {
  const args = Deno.args.slice();
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    Deno.exit(0);
  }

  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    // also handle --name=value
    const pref = name + "=";
    const hit = args.find((a) => a.startsWith(pref));
    if (hit) return hit.slice(pref.length);
    return undefined;
  };
  const hasFlag = (name: string) => args.includes(name);

  const scriptDir = dirname(fromFileUrl(import.meta.url));
  const repoRoot = join(scriptDir, "..", "..");

  await loadDotEnvFiles(repoRoot);

  const explicitVersion = getArg("--version") ?? getArg("-v") ?? (args[0] && !args[0].startsWith("-") ? args[0] : undefined);
  const version = await resolveVersion(explicitVersion, repoRoot);
  const bucketOverride = getArg("--bucket");
  const prefixOverride = getArg("--prefix");
  const dryRun = hasFlag("--dry-run");
  const notesRaw = getArg("--notes");

  // Resolve R2 config
  const endpointRaw = getEnv("R2_Endpoint", "R2_ENDPOINT", "R2_ENDPOINT_URL");
  const { endpoint: endpointBase, pathBucket } = parseEndpoint(endpointRaw);
  const accountId = getEnv("R2_ACCOUNT_ID");
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID", "R2_ACCESS_KEY");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY", "R2_SECRET_KEY");
  const publicBucket = getEnv("R2_PUBLIC_BUCKET");
  const privateBucket = getEnv("R2_PRIVATE_BUCKET");
  const publicUrlRaw = getEnv("R2_PUBLIC_URL", "R2_PUBLIC_URL_BASE");
  const objectPrefix = prefixOverride ?? getEnv("R2_OBJECT_PREFIX") ?? "compressy";
  const bucket = bucketOverride ?? publicBucket ?? privateBucket ?? pathBucket ?? "compressy";

  if (!dryRun) {
    if (!accessKeyId || !secretAccessKey) {
      console.error("Missing R2 credentials: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (check .env)");
      Deno.exit(1);
    }
    if (!endpointBase) {
      console.error("Missing R2 endpoint: R2_Endpoint (check .env)");
      Deno.exit(1);
    }
    if (!bucket) {
      console.error("Missing R2 bucket: R2_PUBLIC_BUCKET / R2_PRIVATE_BUCKET");
      Deno.exit(1);
    }
  }

  console.log(`\nCompressy release — v${version}${dryRun ? " (dry-run)" : ""}`);
  console.log(`Repo root: ${repoRoot}`);
  console.log(`Bucket: ${bucket}  prefix: ${objectPrefix}  endpoint: ${endpointBase || "(none, dry-run)"}`);
  if (publicUrlRaw) console.log(`Public URL base: ${publicUrlRaw}`);

  // Discover artifacts
  const distCandidates = [
    join(repoRoot, "dist"),
    join(repoRoot, "desktop-app", "dist"),
  ];
  const artifacts = await findArtifacts(distCandidates);
  // Also explicitly check for dist/*.exe at repo root even if walk missed due to filtering
  // (fallback glob)
  if (artifacts.length === 0) {
    console.warn("No .exe / archive files found under dist/. Build first: deno task build:installer");
  } else {
    console.log(`\nFound ${artifacts.length} artifact(s):`);
    for (const f of artifacts) {
      try {
        const st = await Deno.stat(f);
        console.log(`  - ${f}  (${humanSize(st.size)})`);
      } catch {
        console.log(`  - ${f}`);
      }
    }
  }

  if (artifacts.length === 0) {
    console.error("\nNo artifacts to publish. Aborting releases.json update.");
    Deno.exit(1);
  }

  // Prepare S3 client (if not dry-run)
  let s3: S3Client | null = null;
  if (!dryRun) {
    const endpointForClient = endpointBase;
    s3 = new S3Client({
      region: "auto",
      endpoint: endpointForClient,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! } : undefined,
      forcePathStyle: false,
    });
  }

  // Upload each artifact (or simulate)
  const assets: ReleaseAsset[] = [];
  const publicUrlBase = publicUrlRaw ? publicUrlRaw.replace(/\/+$/, "") : undefined;

  for (const filePath of artifacts) {
    const fileName = basename(filePath);
    const key = `${objectPrefix}/${version}/${fileName}`;
    const contentType = contentTypeFor(fileName);

    let bytes: Uint8Array;
    try {
      bytes = await Deno.readFile(filePath);
    } catch (e) {
      console.error(`Failed to read ${filePath}: ${e}`);
      continue;
    }
    const sha = await sha256Hex(bytes);
    const shaShort = sha.slice(0, 12);
    let size: number;
    try {
      size = (await Deno.stat(filePath)).size;
    } catch {
      size = bytes.byteLength;
    }
    const sizeLabel = humanSize(size);
    const type = assetTypeFor(fileName);
    const url = publicUrlBase ? `${publicUrlBase}/${key}` : `https://${bucket}.r2.dev/${key}`;

    if (dryRun) {
      console.log(`\n[dry-run] Would upload ${fileName} -> s3://${bucket}/${key} (${sizeLabel}, sha256:${shaShort}…)`);
    } else {
      console.log(`\nUploading ${fileName} -> s3://${bucket}/${key} (${sizeLabel}) …`);
      try {
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        });
        await s3!.send(cmd);
        console.log(`  ✓ Uploaded (${shaShort}…)`);
        // Verify via HEAD? skip
      } catch (e) {
        console.error(`  ✗ Upload failed for ${fileName}:`, e);
        console.error("  Aborting release — releases.json not updated.");
        Deno.exit(1);
      }
    }

    assets.push({
      name: fileName,
      file: fileName,
      key,
      url,
      size,
      sizeLabel,
      sha256: sha,
      shaShort,
      type,
      contentType,
    });
  }

  // Build release entry
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10); // yyyy-mm-dd
  const displayDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let notes: { added: string[]; improved: string[]; fixed: string[] } = { added: [], improved: [], fixed: [] };
  if (notesRaw) {
    try {
      const parsed = JSON.parse(notesRaw);
      if (typeof parsed === "object" && parsed !== null) {
        notes.added = Array.isArray(parsed.added) ? parsed.added : [];
        notes.improved = Array.isArray(parsed.improved) ? parsed.improved : [];
        notes.fixed = Array.isArray(parsed.fixed) ? parsed.fixed : [];
        if (!notes.added.length && !notes.improved.length && !notes.fixed.length && typeof parsed === "string") {
          notes.added = [String(parsed)];
        }
      }
    } catch {
      // treat raw as single added note
      notes.added = [notesRaw];
    }
  } else {
    // default placeholder
    notes.added = [`Release v${version}`];
  }

  // derive tags from notes that have entries
  const tags: string[] = [];
  if (notes.added.length) tags.push("added");
  if (notes.improved.length) tags.push("improved");
  if (notes.fixed.length) tags.push("fixed");
  if (tags.length === 0) tags.push("added");

  const versionTag = version.startsWith("v") ? version : `v${version}`;
  const assetsBase = publicUrlBase ? `${publicUrlBase}/${objectPrefix}/${version}` : `https://${bucket}.r2.dev/${objectPrefix}/${version}`;
  const kind = "stable";

  const newEntry: ReleaseEntry = {
    version,
    versionTag,
    date: displayDate,
    displayDate,
    title: `Compressy ${versionTag}`,
    channel: "stable",
    kind,
    latest: true,
    tags,
    notes,
    summary: notes.added[0] ?? `Compressy ${versionTag}`,
    assets,
    assetsBase,
  };

  // Update releases JSON — primary: website/public/data/releases.json, mirror: data/releases.json (identical data)
  const websiteReleasesPath = join(repoRoot, "website", "public", "data", "releases.json");
  const legacyReleasesPath = join(repoRoot, "data", "releases.json");
  const releasesPaths = [websiteReleasesPath, legacyReleasesPath];

  if (dryRun) {
    for (const p of releasesPaths) {
      console.log(`\n[dry-run] Would update ${p} — ${assets.length} asset(s), newest: v${version} (${isoDate})`);
      for (const a of assets) {
        console.log(`    - ${a.name}  ${a.sizeLabel}  ${a.shaShort}…`);
        console.log(`      ${a.url}`);
      }
    }
    console.log("\n[dry-run] No files were uploaded and releases.json was not modified. Remove --dry-run to publish.");
  } else {
    for (const releasesPath of releasesPaths) {
      let existing: ReleaseEntry[] = [];
      try {
        const raw = await Deno.readTextFile(releasesPath);
        const trimmed = raw.trim();
        if (trimmed) {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) existing = parsed;
          else if (parsed && Array.isArray(parsed.releases)) existing = parsed.releases;
          else if (parsed && typeof parsed === "object") existing = [parsed as ReleaseEntry];
        }
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) {
          console.warn(`Could not parse ${releasesPath} — starting fresh:`, e);
        }
        existing = [];
      }

      const prevLen = existing.length;
      existing = existing.filter((r) => r.version !== version);
      if (existing.length !== prevLen) {
        console.log(`\nRemoved existing entry for v${version} in ${releasesPath} (re-publishing)`);
      }
      for (const r of existing) r.latest = false;

      const updated = [newEntry, ...existing];

      await Deno.mkdir(dirname(releasesPath), { recursive: true }).catch(() => {});
      await Deno.writeTextFile(releasesPath, JSON.stringify(updated, null, 2) + "\n");
      console.log(`\n✓ releases.json updated — ${releasesPath}`);
      console.log(`  ${updated.length} release(s), newest: ${versionTag} (${newEntry.date}) with ${newEntry.assets.length} asset(s)`);
      for (const a of newEntry.assets) {
        console.log(`    - ${a.name}  ${a.sizeLabel}  ${a.shaShort}…`);
        console.log(`      ${a.url}`);
      }
    }
    console.log("\nDone. Commit website/public/data/releases.json (and data/releases.json) and deploy.");
    console.log(`Public assets base: ${assetsBase}`);
  }
}

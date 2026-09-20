import { z } from "zod";
import { dirname, join } from "std/path";
import { AppSettings, AppSettingsSchema } from "./types.ts";

export const DEFAULT_SETTINGS: AppSettings = {
  quality: 85,
  mode: "balanced",
  format: "keep",
  lossless: false,
  stripMeta: true,
  overwrite: true,
  skipSmall: false,
  threads: 4,
  maxW: null,
  maxH: null,
  resizeOn: false,
  renameOn: false,
  renamePrefix: "",
  sortBy: "name-asc",
  lastFolder: null,
};

const WindowGeometrySchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  x: z.number().int().nullable(),
  y: z.number().int().nullable(),
}).partial();
export type WindowGeometry = z.infer<typeof WindowGeometrySchema>;

/** App-owned data directory (overridable for tests). */
export function appDataDir(base?: string): string {
  const root = base ??
    Deno.env.get("LOCALAPPDATA") ??
    Deno.env.get("USERPROFILE") ??
    Deno.env.get("HOME") ??
    ".";
  return join(root, "compressy");
}

function settingsPath(dir: string): string {
  return join(dir, "settings.json");
}

function windowPath(dir: string): string {
  return join(dir, "window.json");
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await Deno.writeTextFile(tmp, JSON.stringify(value, null, 2));
  await Deno.rename(tmp, path);
}

/**
 * Read + validate a JSON file. Missing/corrupt/out-of-schema content falls
 * back to `fallback`; a partial object is tolerated and merged over it.
 */
async function readJson<T>(
  path: string,
  schema: z.ZodType<Partial<T>>,
  fallback: T,
): Promise<T> {
  let stored: Partial<T> = {};
  try {
    const parsed = schema.safeParse(JSON.parse(await Deno.readTextFile(path)));
    if (parsed.success) stored = parsed.data;
  } catch {
    // Missing or corrupt — fall back.
  }
  return { ...fallback, ...stored };
}

export async function loadSettings(base?: string): Promise<AppSettings> {
  const merged = await readJson(
    settingsPath(appDataDir(base)),
    AppSettingsSchema.partial(),
    DEFAULT_SETTINGS,
  );
  return AppSettingsSchema.parse(merged);
}

export async function saveSettings(s: AppSettings, base?: string): Promise<void> {
  await writeJsonAtomic(settingsPath(appDataDir(base)), AppSettingsSchema.parse(s));
}

export async function loadWindowGeometry(base?: string): Promise<WindowGeometry> {
  return readJson(windowPath(appDataDir(base)), WindowGeometrySchema, {});
}

export async function saveWindowGeometry(
  g: WindowGeometry,
  base?: string,
): Promise<void> {
  await writeJsonAtomic(windowPath(appDataDir(base)), WindowGeometrySchema.parse(g));
}

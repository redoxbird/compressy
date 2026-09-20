import { z } from "zod";

// ── Image formats ──────────────────────────────────────────────────────────

export const ExtSchema = z.enum(["jpg", "png", "webp", "avif"]);
export type ImageExt = z.infer<typeof ExtSchema>;

// ── Scan ───────────────────────────────────────────────────────────────────

export const FileEntrySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  ext: ExtSchema,
  size: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  mtime: z.number().int().nonnegative(), // epoch ms — drives Newest/Oldest sort
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const ScanResultSchema = z.object({
  folder: z.string().min(1),
  files: z.array(FileEntrySchema),
  errors: z.number().int().nonnegative(),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

// ── Compression ────────────────────────────────────────────────────────────

export const CompressFileInputSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  ext: ExtSchema,
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export type CompressFileInput = z.infer<typeof CompressFileInputSchema>;

export const CompressRequestSchema = z.object({
  files: z.array(CompressFileInputSchema).min(1),
  quality: z.number().int().min(40).max(95),
  mode: z.enum(["balanced", "max", "fast"]),
  format: z.enum(["keep", "webp", "avif", "jpeg"]),
  lossless: z.boolean(),
  stripMeta: z.boolean(),
  overwrite: z.boolean(),
  maxW: z.number().int().positive().nullable(),
  maxH: z.number().int().positive().nullable(),
  resizeOn: z.boolean(),
  threads: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  renameOn: z.boolean(),
  renamePrefix: z.string().max(24).default(""),
});
export type CompressRequest = z.infer<typeof CompressRequestSchema>;

/** Per-file options sent to workers: the request minus the file list. */
export type CompressOptions = Omit<CompressRequest, "files" | "threads">;

export interface WorkerJob {
  id: number;
  file: CompressFileInput;
  opts: CompressOptions;
}

export const FileResultSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  ext: z.string().min(1), // original extension (icon)
  format: z.string().min(1), // output format, ext-style ("jpg"|"png"|"webp"|"avif")
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  resized: z.boolean(),
  before: z.number().int().nonnegative(),
  after: z.number().int().nonnegative(),
  saved: z.number().int(),
  savedPct: z.number().int(),
  renamed: z.boolean().optional(), // output name differs from input (auto-rename)
  failed: z.boolean().optional(),
  error: z.string().optional(),
});
export type FileResult = z.infer<typeof FileResultSchema>;

export const CompressResultSchema = z.object({
  cancelled: z.boolean(),
  totalBefore: z.number().int().nonnegative(),
  totalAfter: z.number().int().nonnegative(),
  files: z.array(FileResultSchema),
});
export type CompressResult = z.infer<typeof CompressResultSchema>;

export const ProgressStateSchema = z.object({
  total: z.number().int().positive(),
  done: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  currentName: z.string(),
  running: z.boolean(),
});
export type ProgressState = z.infer<typeof ProgressStateSchema>;

// ── Settings ───────────────────────────────────────────────────────────────

export const AppSettingsSchema = z.object({
  quality: z.number().int().min(40).max(95),
  mode: z.enum(["balanced", "max", "fast"]),
  format: z.enum(["keep", "webp", "avif", "jpeg"]),
  lossless: z.boolean(),
  stripMeta: z.boolean(),
  overwrite: z.boolean(),
  skipSmall: z.boolean(),
  threads: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  maxW: z.number().int().positive().nullable(),
  maxH: z.number().int().positive().nullable(),
  resizeOn: z.boolean(),
  renameOn: z.boolean(),
  renamePrefix: z.string().max(24).default(""),
  sortBy: z.enum(["name-asc", "name-desc", "size-desc", "size-asc", "mtime-desc", "mtime-asc", "type"]).default("name-asc"),
  lastFolder: z.string().nullable(),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ── Window (structural — `Deno.BrowserWindow` is not in the public type lib) ─

export interface DesktopWindow {
  bind(name: string, handler: (...args: unknown[]) => unknown): void;
  addEventListener(type: string, cb: (e: Event) => void): void;
  setTitle(title: string): void;
  setSize(w: number, h: number): void;
  getSize(): [number, number];
  getPosition(): [number, number];
  close(): void;
}

// ── Webview-facing binding contract ────────────────────────────────────────

export interface Bindings {
  getVersion(): Promise<string>;
  loadSettings(): Promise<AppSettings>;
  saveSettings(s: AppSettings): Promise<void>;
  scan(folder: string): Promise<ScanResult>;
  compress(req: CompressRequest): Promise<CompressResult>;
  getProgress(): Promise<ProgressState | null>;
  cancelCompress(): Promise<void>;
  exportCsv(folder: string, results: FileResult[]): Promise<{ path: string }>;
  openFolder(path: string): Promise<void>;
  openFile(path: string): Promise<void>;
  revealPath(path: string): Promise<void>;
}

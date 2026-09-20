import { assertEquals } from "jsr:@std/assert";
import { join } from "std/path";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  loadWindowGeometry,
  saveSettings,
  saveWindowGeometry,
} from "../settings.ts";

function tmpBase(): string {
  return Deno.makeTempDirSync({ prefix: "compressy-test-" });
}

Deno.test("loadSettings: missing file returns defaults", async () => {
  const s = await loadSettings(tmpBase());
  assertEquals(s, DEFAULT_SETTINGS);
});

Deno.test("loadSettings: save/load roundtrip", async () => {
  const base = tmpBase();
  const custom: typeof DEFAULT_SETTINGS = {
    ...DEFAULT_SETTINGS,
    quality: 60,
    mode: "max",
    format: "webp",
    lossless: true,
    stripMeta: false,
    overwrite: false,
    skipSmall: true,
    threads: 8,
    maxW: 1920,
    maxH: null,
    resizeOn: false,
    lastFolder: "C:\\Pictures\\Test",
  };
  await saveSettings(custom, base);
  assertEquals(await loadSettings(base), custom);
});

async function seedSettings(base: string, content: string): Promise<void> {
  const dir = join(base, "compressy");
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(join(dir, "settings.json"), content);
}

Deno.test("loadSettings: corrupt file falls back to defaults", async () => {
  const base = tmpBase();
  await seedSettings(base, "{not json!!");
  assertEquals(await loadSettings(base), DEFAULT_SETTINGS);
});

Deno.test("loadSettings: out-of-schema value falls back to defaults", async () => {
  const base = tmpBase();
  await seedSettings(base, JSON.stringify({ quality: 999, mode: "turbo" }));
  assertEquals(await loadSettings(base), DEFAULT_SETTINGS);
});

Deno.test("loadSettings: partial file merges over defaults", async () => {
  const base = tmpBase();
  await seedSettings(base, JSON.stringify({ quality: 70, threads: 2 }));
  const s = await loadSettings(base);
  assertEquals(s.quality, 70);
  assertEquals(s.threads, 2);
  assertEquals(s.mode, "balanced"); // from defaults
  assertEquals(s.stripMeta, true); // from defaults
});

Deno.test("loadSettings: sortBy roundtrip + migration default", async () => {
  const base = tmpBase();
  await seedSettings(base, JSON.stringify({ quality: 70 }));
  const s = await loadSettings(base);
  assertEquals(s.sortBy, "name-asc"); // old files gain the default
  await saveSettings({ ...s, sortBy: "mtime-desc" }, base);
  assertEquals((await loadSettings(base)).sortBy, "mtime-desc");
});

Deno.test("saveSettings: atomic write leaves no .tmp", async () => {
  const base = tmpBase();
  await saveSettings({ ...DEFAULT_SETTINGS, quality: 50 }, base);
  const dir = join(base, "compressy");
  const entries = [...Deno.readDirSync(dir)].map((e) => e.name);
  assertEquals(entries, ["settings.json"]);
});

Deno.test("window geometry: missing -> {}; roundtrip", async () => {
  const base = tmpBase();
  assertEquals(await loadWindowGeometry(base), {});
  await saveWindowGeometry({ width: 1200, height: 860, x: 10, y: 20 }, base);
  assertEquals(await loadWindowGeometry(base), { width: 1200, height: 860, x: 10, y: 20 });
});

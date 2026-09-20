import { assertEquals, assertGreater } from "jsr:@std/assert";
import { join } from "std/path";
import { scanFolder } from "../scanner.ts";
import { makeImage } from "./helpers.ts";

Deno.test("scanFolder: finds supported images, ignores others", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "scan-" });
  makeImage(dir, "a.jpg", "jpeg");
  makeImage(dir, "b.PNG", "png"); // uppercase ext
  makeImage(dir, "c.webp", "webp");
  makeImage(dir, "d.avif", "avif");
  await Deno.writeTextFile(join(dir, "notes.txt"), "not an image");

  const r = await scanFolder(dir);
  assertEquals(r.errors, 0);
  assertEquals(r.files.length, 4);
  assertEquals(r.files.map((f) => f.ext).sort(), ["avif", "jpg", "png", "webp"]);
});

Deno.test("scanFolder: recurses into subfolders", async () => {
  const root = Deno.makeTempDirSync({ prefix: "scan-" });
  const sub = join(root, "nested", "deeper");
  await Deno.mkdir(sub, { recursive: true });
  makeImage(root, "top.png", "png");
  makeImage(sub, "deep.jpg", "jpeg");

  const r = await scanFolder(root);
  assertEquals(r.files.length, 2);
  assertEquals(r.files.map((f) => f.name).sort(), ["deep.jpg", "top.png"]);
});

Deno.test("scanFolder: numeric name sort", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "scan-" });
  for (const n of ["img10.png", "img2.png", "img1.png"]) makeImage(dir, n, "png");
  const r = await scanFolder(dir);
  assertEquals(r.files.map((f) => f.name), ["img1.png", "img2.png", "img10.png"]);
});

Deno.test("scanFolder: corrupt file counted in errors", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "scan-" });
  makeImage(dir, "ok.jpg", "jpeg");
  await Deno.writeFile(join(dir, "fake.png"), new Uint8Array([1, 2, 3, 4, 5]));
  const r = await scanFolder(dir);
  assertEquals(r.errors, 1);
  assertEquals(r.files.length, 1);
  assertEquals(r.files[0].name, "ok.jpg");
});

Deno.test("scanFolder: metadata correct (w/h/size)", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "scan-" });
  makeImage(dir, "pic.png", "png", 40, 30);
  const r = await scanFolder(dir);
  assertEquals(r.files[0].w, 40);
  assertEquals(r.files[0].h, 30);
  assertGreater(r.files[0].size, 0);
});

Deno.test("scanFolder: mtime present for every file", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "scan-" });
  makeImage(dir, "a.jpg", "jpeg");
  makeImage(dir, "b.png", "png");
  const r = await scanFolder(dir);
  assertEquals(r.files.length, 2);
  for (const f of r.files) {
    assertGreater(f.mtime, 0, `${f.name} has mtime`);
  }
});

Deno.test("scanFolder: backup folders are filtered from the list", async () => {
  // Hand-built PNGs (no vips needed): signature + IHDR + IEND.
  const png = (w: number, h: number): Uint8Array => {
    const b = new Uint8Array(45);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const dv = new DataView(b.buffer);
    dv.setUint32(8, 13);
    b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
    dv.setUint32(16, w);
    dv.setUint32(20, h);
    b[24] = 8; // bit depth
    b[25] = 2; // truecolor
    b.set([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], 33); // IEND
    return b;
  };
  const dir = Deno.makeTempDirSync({ prefix: "scan-" });
  await Deno.mkdir(join(dir, "backup"));
  await Deno.writeFile(join(dir, "backup", "old.png"), png(10, 10));
  await Deno.mkdir(join(dir, "sub", "Backup"), { recursive: true });
  await Deno.writeFile(join(dir, "sub", "Backup", "old2.png"), png(10, 10));
  await Deno.writeFile(join(dir, "sub", "live.png"), png(10, 10));
  await Deno.writeFile(join(dir, "keep.png"), png(20, 20));
  const r = await scanFolder(dir);
  assertEquals(r.errors, 0);
  assertEquals(r.files.map((f) => f.name), ["keep.png", "live.png"]);
});

Deno.test("scanFolder: does not leave mapped lock on files (overwrite works after scan)", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "scan-" });
  makeImage(dir, "lock.webp", "webp");
  const r = await scanFolder(dir);
  assertEquals(r.files.length, 1);
  // Overwriting a scanned file must work.
  const buf = await Deno.readFile(r.files[0].path);
  await Deno.writeFile(r.files[0].path, buf);
});

Deno.test("scanFolder: unreadable subfolder counted in errors", { ignore: Deno.build.os === "windows" }, async () => {
  const root = Deno.makeTempDirSync({ prefix: "scan-" });
  const locked = join(root, "locked");
  await Deno.mkdir(locked);
  await Deno.chmod(locked, 0o000);
  try {
    const r = await scanFolder(root);
    assertEquals(r.errors, 1);
    assertEquals(r.files.length, 0);
  } finally {
    await Deno.chmod(locked, 0o755);
  }
});

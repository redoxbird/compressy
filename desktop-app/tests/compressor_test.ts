import { assertEquals, assertGreater, assertLess } from "jsr:@std/assert";
import { join } from "std/path";
import { compressFiles, currentProgress, requestCancel, resetCancel } from "../compressor.ts";
import { compressOne, targetFormat } from "../worker.ts";
import { CompressRequest } from "../types.ts";
import { imageDims, makeImage } from "./helpers.ts";

function baseReq(dir: string, names: string[]): CompressRequest {
  return {
    files: names.map((n) => ({
      path: join(dir, n),
      name: n,
      ext: (n.slice(n.lastIndexOf(".") + 1).toLowerCase() === "jpeg" ? "jpg" : n.slice(n.lastIndexOf(".") + 1).toLowerCase()) as "jpg" | "png" | "webp" | "avif",
      w: 400,
      h: 300,
    })),
    quality: 60,
    mode: "balanced",
    format: "keep",
    lossless: false,
    stripMeta: true,
    overwrite: false, // tests write -compressed files, never touch originals
    maxW: null,
    maxH: null,
    resizeOn: true,
    renameOn: false,
    renamePrefix: "",
    threads: 4,
  };
}

Deno.test("targetFormat: keep/conversion mapping", () => {
  assertEquals(targetFormat("jpg", "keep"), "jpg");
  assertEquals(targetFormat("png", "keep"), "png");
  assertEquals(targetFormat("jpg", "webp"), "webp");
  assertEquals(targetFormat("png", "jpeg"), "jpg");
  assertEquals(targetFormat("webp", "avif"), "avif");
});

Deno.test("compressOne: JPEG shrinks and reports saved", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "a.jpg", "jpeg");
  const r = await compressOne({ path: join(dir, "a.jpg"), name: "a.jpg", ext: "jpg", w: 400, h: 300 }, {
    quality: 50, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: false, maxW: null, maxH: null, resizeOn: true, renameOn: false, renamePrefix: "",
  });
  assertEquals(r.failed, undefined);
  assertGreater(r.saved, 0);
  assertEquals(r.format, "jpg");
  assertEquals(r.w, 400);
  assertEquals(r.h, 300);
});

Deno.test("compressOne: resize downscales to max dims", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "big.png", "png", 800, 600);
  const r = await compressOne({ path: join(dir, "big.png"), name: "big.png", ext: "png", w: 800, h: 600 }, {
    quality: 80, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: false, maxW: 200, maxH: null, resizeOn: true, renameOn: false, renamePrefix: "",
  });
  assertEquals(r.w, 200);
  assertEquals(r.h, 150);
  assertEquals(r.resized, true);
});

Deno.test("compressOne: no upscaling when smaller than limit", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "small.png", "png", 100, 80);
  const r = await compressOne({ path: join(dir, "small.png"), name: "small.png", ext: "png", w: 100, h: 80 }, {
    quality: 80, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: false, maxW: 500, maxH: null, resizeOn: true, renameOn: false, renamePrefix: "",
  });
  assertEquals(r.w, 100);
  assertEquals(r.h, 80);
  assertEquals(r.resized, false);
});

Deno.test("compressOne: conversion to webp", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "c.png", "png", 400, 300, "gradient");
  const r = await compressOne({ path: join(dir, "c.png"), name: "c.png", ext: "png", w: 400, h: 300 }, {
    quality: 70, mode: "balanced", format: "webp", lossless: false, stripMeta: true,
    overwrite: false, maxW: null, maxH: null, resizeOn: true, renameOn: false, renamePrefix: "",
  });
  assertEquals(r.format, "webp");
  const dims = imageDims(join(dir, "c-compressed.webp"));
  assertEquals(dims.w, 400);
  assertGreater(r.saved, 0);
});

Deno.test("compressOne: corrupt input throws", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  await Deno.writeFile(join(dir, "bad.jpg"), new Uint8Array([1, 2, 3, 4]));
  let threw = false;
  try {
    await compressOne({ path: join(dir, "bad.jpg"), name: "bad.jpg", ext: "jpg", w: 400, h: 300 }, {
      quality: 70, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
      overwrite: false, maxW: null, maxH: null, resizeOn: true, renameOn: false, renamePrefix: "",
    });
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("compressFiles: pool processes all, results in order", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  const names = ["a.jpg", "b.png", "c.webp"];
  for (const n of names) makeImage(dir, n, n.endsWith(".png") ? "png" : n.endsWith(".webp") ? "webp" : "jpeg");
  resetCancel();
  const r = await compressFiles(baseReq(dir, names));
  assertEquals(r.cancelled, false);
  assertEquals(r.files.length, 3);
  assertEquals(r.files.map((f) => f.name), names);
  for (const f of r.files) {
    assertEquals(f.failed, undefined);
    assertGreater(f.saved, 0);
  }
  // no-overwrite naming
  assertEquals((await Deno.stat(join(dir, "a-compressed.jpg"))).isFile, true);
});

Deno.test("compressFiles: one bad file fails, rest succeed", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "ok1.jpg", "jpeg");
  await Deno.writeFile(join(dir, "bad.png"), new Uint8Array([9, 9, 9]));
  makeImage(dir, "ok2.png", "png");
  resetCancel();
  const r = await compressFiles(baseReq(dir, ["ok1.jpg", "bad.png", "ok2.png"]));
  assertEquals(r.files.length, 3);
  const bad = r.files.find((f) => f.name === "bad.png");
  assertEquals(bad?.failed, true);
  const good = r.files.filter((f) => !f.failed);
  assertEquals(good.length, 2);
  for (const f of good) assertGreater(f.saved, 0);
});

Deno.test("compressFiles: progress tracks completion", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  const names = ["p1.jpg", "p2.png", "p3.webp", "p4.avif"];
  for (const n of names) makeImage(dir, n, n.endsWith(".png") ? "png" : n.endsWith(".webp") ? "webp" : n.endsWith(".avif") ? "avif" : "jpeg");
  resetCancel();
  const p = compressFiles(baseReq(dir, names));
  let seen = null;
  for (let i = 0; i < 60; i++) {
    seen = currentProgress();
    if (seen && seen.done > 0) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  const r = await p;
  assertEquals(r.files.length, 4);
  const final = currentProgress();
  assertEquals(final?.done, 4);
  assertEquals(final?.running, false);
});

Deno.test("compressOne: auto-rename produces {prefix}-{NNNN}.{ext}", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "a.jpg", "jpeg");
  const r = await compressOne({ path: join(dir, "a.jpg"), name: "a.jpg", ext: "jpg", w: 400, h: 300 }, {
    quality: 50, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: false, maxW: null, maxH: null, resizeOn: true, renameOn: true, renamePrefix: "photo",
  }, 1);
  assertEquals(r.renamed, true);
  assertEquals(r.name, "photo-0001.jpg");
  assertEquals((await Deno.stat(join(dir, "photo-0001.jpg"))).isFile, true);
  // original untouched (no-overwrite + rename)
  assertEquals((await Deno.stat(join(dir, "a.jpg"))).isFile, true);
});

Deno.test("compressOne: rename counter zero-pads and keeps output extension", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "b.png", "png", 400, 300, "gradient");
  const r = await compressOne({ path: join(dir, "b.png"), name: "b.png", ext: "png", w: 400, h: 300 }, {
    quality: 70, mode: "balanced", format: "webp", lossless: false, stripMeta: true,
    overwrite: false, maxW: null, maxH: null, resizeOn: true, renameOn: true, renamePrefix: "shot",
  }, 42);
  assertEquals(r.name, "shot-0042.webp");
  assertEquals(r.format, "webp");
  assertEquals((await Deno.stat(join(dir, "shot-0042.webp"))).isFile, true);
});

Deno.test("compressOne: rename with empty prefix keeps original name", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "c.jpg", "jpeg");
  const r = await compressOne({ path: join(dir, "c.jpg"), name: "c.jpg", ext: "jpg", w: 400, h: 300 }, {
    quality: 50, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: false, maxW: null, maxH: null, resizeOn: true, renameOn: true, renamePrefix: "  ",
  }, 1);
  assertEquals(r.renamed, false);
  assertEquals(r.name, "c.jpg");
});

Deno.test("compressFiles: rename counter assigned in job order", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  const names = ["z.jpg", "a.png", "m.webp"];
  for (const n of names) makeImage(dir, n, n.endsWith(".png") ? "png" : n.endsWith(".webp") ? "webp" : "jpeg");
  resetCancel();
  const req = baseReq(dir, names);
  req.renameOn = true;
  req.renamePrefix = "img";
  const r = await compressFiles(req);
  assertEquals(r.files.map((f) => f.name), ["img-0001.jpg", "img-0002.png", "img-0003.webp"]);
  for (const f of r.files) assertEquals(f.renamed, true);
  for (const n of ["img-0001.jpg", "img-0002.png", "img-0003.webp"]) {
    assertEquals((await Deno.stat(join(dir, n))).isFile, true, n + " exists");
  }
});

Deno.test("compressOne: overwrite moves original into backup folder", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "ow.jpg", "jpeg", 800, 600);
  const orig = await Deno.readFile(join(dir, "ow.jpg"));
  const r = await compressOne({ path: join(dir, "ow.jpg"), name: "ow.jpg", ext: "jpg", w: 800, h: 600 }, {
    quality: 50, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: true, maxW: null, maxH: null, resizeOn: false, renameOn: false, renamePrefix: "",
  });
  assertEquals(r.failed, undefined);
  assertGreater(r.saved, 0);
  // original replaced in place
  const now = await Deno.readFile(join(dir, "ow.jpg"));
  assertEquals(now.length, r.after);
  assertLess(now.length, orig.length);
  // original preserved in backup/
  const bak = await Deno.readFile(join(dir, "backup", "ow.jpg"));
  assertEquals(bak.length, orig.length);
});

Deno.test("compressOne: resize with only maxH preserves aspect", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "wide.png", "png", 1200, 900);
  const r = await compressOne({ path: join(dir, "wide.png"), name: "wide.png", ext: "png", w: 1200, h: 900 }, {
    quality: 80, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: false, maxW: null, maxH: 600, resizeOn: true, renameOn: false, renamePrefix: "",
  });
  assertEquals(r.failed, undefined);
  assertEquals(r.w, 800);
  assertEquals(r.h, 600);
  assertEquals(r.resized, true);
});

Deno.test("compressOne: resize with only maxW preserves aspect", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  makeImage(dir, "tall.png", "png", 900, 1200);
  const r = await compressOne({ path: join(dir, "tall.png"), name: "tall.png", ext: "png", w: 900, h: 1200 }, {
    quality: 80, mode: "balanced", format: "keep", lossless: false, stripMeta: true,
    overwrite: false, maxW: 600, maxH: null, resizeOn: true, renameOn: false, renamePrefix: "",
  });
  assertEquals(r.failed, undefined);
  assertEquals(r.w, 600);
  assertEquals(r.h, 800);
  assertEquals(r.resized, true);
});

Deno.test("compressFiles: cancel stops early", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "comp-" });
  const names = Array.from({ length: 8 }, (_, i) => `c${i}.png`);
  for (const n of names) makeImage(dir, n, "png");
  resetCancel();
  const p = compressFiles(baseReq(dir, names));
  setTimeout(() => requestCancel(), 100);
  const r = await p;
  assertEquals(r.cancelled, true);
  assertLess(r.files.filter((f) => !f.failed).length, 8);
});

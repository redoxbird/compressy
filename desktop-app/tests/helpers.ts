// Test helpers: generate real images via the vendored vips CLI (no sharp).
import { join } from "std/path";
import { runHeaderSync, runVipsSync } from "../vips.ts";

export type TestFormat = "jpeg" | "png" | "webp" | "avif";

/** PPM writer: a noisy or gradient RGB image of w×h. */
function writePpm(path: string, w: number, h: number, content: "noise" | "gradient"): void {
  const lines: string[] = [`P6`, `${w} ${h}`, `255`];
  const body = new Uint8Array(w * h * 3);
  if (content === "noise") {
    let seed = 42;
    for (let i = 0; i < body.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      body[i] = seed & 255;
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        body[i] = Math.round((x / w) * 255);
        body[i + 1] = Math.round((y / h) * 255);
        body[i + 2] = Math.round(((x + y) / (w + h)) * 255);
      }
    }
  }
  const header = new TextEncoder().encode(lines.join("\n") + "\n");
  const file = Deno.openSync(path, { write: true, create: true, truncate: true });
  try {
    file.writeSync(header);
    file.writeSync(body);
  } finally {
    file.close();
  }
}

/**
 * Create a real image of the given format. `noise` compresses poorly (PNG/JPEG
 * shrink well on re-encode); `gradient` is smooth (WebP/AVIF prediction excels).
 */
export function makeImage(
  dir: string,
  name: string,
  format: TestFormat,
  w = 400,
  h = 300,
  content: "noise" | "gradient" = "noise",
): void {
  const ppm = join(dir, `__fixture_${Date.now()}_${Math.random().toString(36).slice(2)}.ppm`);
  writePpm(ppm, w, h, content);
  const fmt = format === "jpeg" ? "jpeg" : format === "avif" ? "heif" : format;
  const r = runVipsSync([`${fmt}save`, ppm, join(dir, name), "--Q", "100"]);
  if (r.code !== 0) throw new Error(`fixture ${name} failed: ${r.stderr}`);
  Deno.removeSync(ppm);
}

/** Read image dims via vipsheader. */
export function imageDims(path: string): { w: number; h: number } {
  const w = runHeaderSync([path, "-f", "width"]);
  const h = runHeaderSync([path, "-f", "height"]);
  return { w: parseInt(w.stdout.trim(), 10), h: parseInt(h.stdout.trim(), 10) };
}

/** Read an image file into a Uint8Array. */
export function readBytes(path: string): Uint8Array {
  return Deno.readFileSync(path);
}

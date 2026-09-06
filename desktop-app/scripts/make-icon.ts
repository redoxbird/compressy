// Generates design/app.ico from design/icon.png using the vendored vips
// (resize to 256 — ICO max entry — then save as ICO via ImageMagick).
// Run: deno task make-icon
import { fromFileUrl } from "jsr:@std/path@^1";

const vips = fromFileUrl(new URL("../vendor/vips/bin/vips.exe", import.meta.url));
const src = fromFileUrl(new URL("../../design/icon.png", import.meta.url));
const tmp = fromFileUrl(new URL("../../design/.app-256.png", import.meta.url));
const out = fromFileUrl(new URL("../../design/app.ico", import.meta.url));

function run(...args: string[]) {
  const p = new Deno.Command(vips, { args, stdout: "piped", stderr: "piped" }).outputSync();
  if (!p.success) {
    throw new Error(`vips ${args[0]} failed: ${new TextDecoder().decode(p.stderr)}`);
  }
}

run("thumbnail", src, tmp, "256");
run("magicksave", tmp, out);
await Deno.remove(tmp);
console.log("Wrote", out, (await Deno.stat(out)).size, "bytes");

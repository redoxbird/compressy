// Fetches the libvips Windows x64 build into vendor/vips/.
// Run: deno task vendor:vips
// Source: https://github.com/libvips/build-win64-mxe/releases (v8.18.5)
import { dirname, fromFileUrl, join } from "std/path";

const VERSION = "8.18.5";
const URL = `https://github.com/libvips/build-win64-mxe/releases/download/v${VERSION}/vips-dev-x64-all-${VERSION}.zip`;

const destDir = join(dirname(fromFileUrl(import.meta.url)), "../vendor/vips");
const zipPath = `${destDir}.zip`;

console.log(`Downloading ${URL} ...`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
await Deno.writeFile(zipPath, new Uint8Array(await res.arrayBuffer()));
console.log("Downloaded", (await Deno.stat(zipPath)).size, "bytes");

console.log("Extracting...");
const tmp = `${destDir}.tmp`;
await Deno.remove(tmp, { recursive: true }).catch(() => {});
await Deno.mkdir(tmp, { recursive: true });
const unzip = new Deno.Command("powershell", {
  args: ["-NoProfile", "-Command", `Expand-Archive -Force '${zipPath}' '${tmp}'`],
  stdout: "piped",
  stderr: "piped",
});
const uz = await unzip.output();
if (!uz.success) throw new Error("unzip failed");

// The zip contains vips-dev-8.18/bin/* — move bin contents into vendor/vips/bin.
await Deno.remove(destDir, { recursive: true }).catch(() => {});
await Deno.mkdir(`${destDir}/bin`, { recursive: true });
const inner = [...Deno.readDirSync(tmp)].find((e) => e.isDirectory);
if (!inner) throw new Error("unexpected zip layout");
for (const entry of Deno.readDirSync(`${tmp}/${inner.name}/bin`)) {
  await Deno.rename(`${tmp}/${inner.name}/bin/${entry.name}`, `${destDir}/bin/${entry.name}`);
}

await Deno.remove(tmp, { recursive: true }).catch(() => {});
await Deno.remove(zipPath).catch(() => {});
console.log("vips vendored into", destDir);

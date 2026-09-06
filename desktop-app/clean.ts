// Cleans the dist output directory before a fresh build.
// Usage: deno task clean
const dist = new URL("../dist/", import.meta.url);
try {
  await Deno.remove(dist, { recursive: true });
  console.log("Removed", dist.pathname);
} catch (err) {
  if (err instanceof Deno.errors.NotFound) {
    console.log("Nothing to clean (dist absent)");
  } else {
    throw err;
  }
}

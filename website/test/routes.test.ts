import { describe, expect, test } from "bun:test";
import { createApp, type Bindings } from "../worker/app";
import type { ElementDef } from "../src/elements/registry";

// ── fixture element + REAL production layout ─────────────────────
const PARTIALS = { "e-pill": `<span class="pill">{{text}}</span>` };
const DEFS: ElementDef[] = [
  { templateName: "e-pill", mapper: (api) => ({ text: api.text() }) },
];
const LAYOUT = (await import("../src/layouts/base.html")).default;

const INDEX_PAGE = `<html><head><title>Home — Compressy</title><meta name="description" content="d"></head>
<body><e-pill>hello</e-pill></body></html>`;
const FAQ_PAGE = `<html><head><title>F</title></head>
<body><e-pill>q</e-pill></body></html>`;

function mockEnv(pages: Record<string, string>) {
  const kv = new Map<string, string>();
  const stats = { gets: 0, puts: 0 };
  const bindings: Bindings = {
    ASSETS: {
      fetch: (async (input: URL | Request | string) => {
        const path = new URL(String(input)).pathname.slice(1); // "index.html"
        const src = pages[path];
        if (src === undefined) return new Response("not found", { status: 404 });
        return new Response(src, { headers: { "content-type": "text/html" } });
      }) as unknown as Fetcher,
    },
    CACHE: {
      get: async (k: string) => {
        stats.gets++;
        return kv.get(k) ?? null;
      },
      put: async (k: string, v: string) => {
        stats.puts++;
        kv.set(k, v);
      },
    } as unknown as KVNamespace,
  };
  return { bindings, kv, stats };
}

function makeApp(pages: Record<string, string>) {
  const { bindings, kv, stats } = mockEnv(pages);
  const app = createApp({ defs: DEFS, partials: PARTIALS, layout: LAYOUT });
  const pending: Promise<unknown>[] = [];
  const execCtx = {
    waitUntil(p: Promise<unknown>) {
      pending.push(p);
    },
    passThroughOnException() {},
  };
  const req = async (path: string) => {
    const res = await app.request(path, undefined, bindings, execCtx);
    await Promise.allSettled(pending.splice(0));
    return res;
  };
  return { req, kv, stats };
}

// ── page expansion route ──────────────────────────────────────────
describe("page routes", () => {
  test("GET / expands the authored page through the layout", async () => {
    const { req } = makeApp({ "index.html": INDEX_PAGE });
    const res = await req("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`class="pill"`);
    expect(html).not.toContain("<e-");
    // URLs must not be entity-escaped (mustache {{ }} escapes slashes)
    expect(html).toContain(`<link rel="canonical" href="https://compressy.app/">`);
    expect(html).not.toContain("&#x2F;");
    expect(html).toContain("Home — Compressy");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  test("second request is served from KV cache without re-expansion", async () => {
    const { req, kv, stats } = makeApp({ "index.html": INDEX_PAGE });
    const a = await req("/");
    const b = await req("/");
    expect(await a.text()).toBe(await b.text());
    expect(kv.size).toBe(1);
    expect(stats.puts).toBe(1);
    expect(stats.gets).toBe(2);
  });

  test("*.html probes never leak raw sources", async () => {
    const { req } = makeApp({ "index.html": INDEX_PAGE });
    const res = await req("/index.html");
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/");
  });

  test("unknown slug renders the expanded 404 page with status 404", async () => {
    const { req } = makeApp({
      "index.html": INDEX_PAGE,
      "404.html": `<html><body><e-pill>missing</e-pill></body></html>`,
    });
    const res = await req("/nope");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`class="pill"`);
  });

  test("slug outside the manifest 404s even when its source exists", async () => {
    // manifest gates publishing — a file in public/ alone doesn't go live
    const { req } = makeApp({
      "not-in-manifest.html": FAQ_PAGE,
      "404.html": `<html><body><e-pill>missing</e-pill></body></html>`,
    });
    const res = await req("/not-in-manifest/");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`class="pill"`);
  });

  test("editing one page invalidates only that page's cache entry", async () => {
    const env1 = makeApp({ "index.html": INDEX_PAGE });
    await env1.req("/");
    await env1.req("/"); // cached
    // same mock env, changed source (simulating redeploy with edited page):
    env1.kv.clear();
    const pages2 = { "index.html": INDEX_PAGE.replace("hello", "changed") };
    const env2 = makeApp(pages2);
    const res = await env2.req("/");
    expect(await res.text()).toContain("changed");
  });
});

// ── infra routes ──────────────────────────────────────────────────
describe("infra routes", () => {
  test("sitemap lists every manifest slug", async () => {
    const { req } = makeApp({});
    const res = await req("/sitemap.xml");
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain(`<loc>https://compressy.app/</loc>`);
  });

  test("robots.txt points at sitemap", async () => {
    const { req } = makeApp({});
    const res = await req("/robots.txt");
    expect(await res.text()).toContain("Sitemap: https://compressy.app/sitemap.xml");
  });

  test("healthz + download redirect", async () => {
    const { req } = makeApp({});
    expect((await req("/healthz")).status).toBe(200);
    const dl = await req("/download");
    expect(dl.status).toBe(302);
    expect(dl.headers.get("Location")).toBe(
      "https://assets.compressy.app/1.4.2/Compressy-setup.exe",
    );
  });

  test("/download pulls the exact installer url from releases.json", async () => {
    const { req } = makeApp({
      "index.html": INDEX_PAGE,
      "data/releases.json": JSON.stringify([
        {
          version: "1.0.0",
          versionTag: "v1.0.0",
          latest: true,
          assets: [
            {
              name: "Compressy-setup.exe",
              type: "installer",
              url: "https://assets.compressy.app/1-0-0/Compressy-setup.exe",
              shaShort: "939a75f8ecfd",
            },
          ],
        },
      ]),
    });
    const dl = await req("/download");
    expect(dl.status).toBe(302);
    expect(dl.headers.get("Location")).toBe(
      "https://assets.compressy.app/1-0-0/Compressy-setup.exe",
    );
    expect(dl.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ── manifest ↔ public sync + classless guard ─────────────────────
describe("manifest sync", () => {
  test("every SLUGS entry exists as public/{slug}.html and vice versa", async () => {
    const { SLUGS } = await import("../src/manifest");
    const onDisk = new Set<string>();
    for await (const name of new Bun.Glob("*.html").scan({ cwd: "./public" })) {
      onDisk.add(name.replace(/\.html$/, ""));
    }
    const declared = new Set(SLUGS);
    // 404 is infrastructure, not a published page
    onDisk.delete("404");
    expect([...declared].sort()).toEqual([...onDisk].sort());
  });

  test("published pages are fully classless (no class= or style=)", async () => {
    const { SLUGS } = await import("../src/manifest");
    for (const slug of SLUGS) {
      const src = await Bun.file(`./public/${slug}.html`).text();
      expect(src, `${slug}.html must not use class attributes`).not.toMatch(/\bclass\s*=/);
      expect(src, `${slug}.html must not use style attributes`).not.toMatch(/\bstyle\s*=/);
    }
  });
});

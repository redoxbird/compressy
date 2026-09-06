import { Hono } from "hono";
import Mustache from "mustache";
import { site } from "../src/config";
import { createRegistry, REGISTRY_VERSION, type ElementDef } from "../src/elements/registry";
import { PARTIALS, PROD_DEFS } from "../src/elements";
import LAYOUT_SOURCE from "../src/layouts/base.html";
import { expandPage } from "../src/expander";
import { resolveMeta } from "../src/meta";
import { buildJsonLd } from "../src/jsonld";
import { publicPath, SLUGS } from "../src/manifest";

export interface Bindings {
  ASSETS: Fetcher;
  CACHE: KVNamespace;
}

export interface AppDeps {
  defs?: ElementDef[];
  partials?: Record<string, string>;
  layout?: string;
}

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300",
};

async function sha256hex(input: string, slice = 20): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, slice);
}

export function createApp(deps: AppDeps = {}) {
  const defs = deps.defs ?? PROD_DEFS;
  const partials = deps.partials ?? PARTIALS;
  const layout = deps.layout ?? LAYOUT_SOURCE;

  const registry = createRegistry(defs, partials);
  const renderLayout = (view: object) => Mustache.render(layout, view);

  // Preloaded JSON data files (public/data/*.json) — memoized per isolate,
  // but a failed load is retried on the next request instead of sticking.
  let dataPromise: Promise<Record<string, unknown>> | null = null;
  async function loadData(env: Bindings): Promise<Record<string, unknown>> {
    try {
      return await (dataPromise ??= (async () => {
        const out: Record<string, unknown> = {};
        for (const name of site.data ?? []) {
          try {
            const res = await env.ASSETS.fetch(new URL(`/data/${name}.json`, "https://internal/"));
            if (res.ok) out[name] = await res.json();
          } catch {
            // missing/corrupt data file degrades to empty — pages render without it
          }
        }
        return out;
      })());
    } catch {
      dataPromise = null; // allow retry on next request
      return {};
    }
  }

  /** Exact installer URL for the release flagged `latest` (else first). Null when no data. */
  function latestInstallerUrl(data: Record<string, unknown> | undefined): string | null {
    const releases = (data?.releases as Array<{
      assets?: Array<{ url?: string; type?: string }>;
      latest?: boolean;
    }>) ?? [];
    if (releases.length === 0) return null;
    const latest =
      releases.find((r) => r.latest === true) ?? releases[0];
    const assets = latest.assets ?? [];
    const installer = assets.find((a) => a.type === "installer");
    return installer?.url ?? assets[0]?.url ?? null;
  }

  // Cache revision: config + registry version + layout + partial sources +
  // preloaded data JSON. Any change invalidates every cached page; the
  // per-page source hash scopes page-only edits.
  let revMemo: { input: string; value: Promise<string> } | null = null;
  const revFor = (dataJson: string): Promise<string> => {
    const input = JSON.stringify(site) + String(REGISTRY_VERSION) + layout + dataJson +
      Object.entries(registry.sources).map(([k, v]) => `${k}:${v}`).join("\n");
    if (!revMemo || revMemo.input !== input) {
      revMemo = { input, value: sha256hex(input) };
    }
    return revMemo.value;
  };

  const app = new Hono<{ Bindings: Bindings }>();

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  app.get("/healthz", (c) => c.text("ok"));

  app.on(["GET", "HEAD"], "/download", async (c) => {
    const data = await loadData(c.env);
    const exact = latestInstallerUrl(data);
    // no-store: the redirect must never be cached, so a releases.json update
    // (new version) propagates to every visitor immediately
    c.header("Cache-Control", "no-store");
    if (exact) return c.redirect(exact, 302);
    return c.redirect(
      `${site.downloads.assetsBase}/${site.downloads.exePattern.replace("{version}", site.version)}`,
      302,
    );
  });

  app.get("/sitemap.xml", (c) => {
    const urls = SLUGS.map((s) => `  <url><loc>${site.url}${publicPath(s)}</loc></url>`).join("\n");
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
      200,
      { "Content-Type": "application/xml" },
    );
  });

  app.get("/robots.txt", (c) =>
    c.text(`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`),
  );

  async function expandSlug(
    env: Bindings,
    execCtx: { waitUntil(p: Promise<unknown>): void },
    slug: string,
  ): Promise<Response | null> {
    const assetRes = await env.ASSETS.fetch(new URL(`/${slug}.html`, "https://internal/"));
    if (!assetRes.ok) return null;
    const source = await assetRes.text();

    const data = await loadData(env);
    const key = `${await revFor(JSON.stringify(data))}:${slug}:${await sha256hex(source, 16)}`;
    const cached = await env.CACHE.get(key);
    if (cached) return new Response(cached, { status: 200, headers: HTML_HEADERS });

    const path = publicPath(slug);
    const result = expandPage(source, { slug, path, site, data }, registry);
    const meta = resolveMeta(slug, result.meta, site);
    const jsonld = buildJsonLd({ site, collected: result.collected, slug, title: meta.title }).map((b) =>
      JSON.stringify(b),
    );
    // nav items with active flag for the current path
    const navItems = site.nav.map((n) => ({
      ...n,
      active: n.href === path || (path === "/" && n.href === "/"),
    }));
    const html = renderLayout({ site, body: result.body, meta, jsonld, navItems }) as string;

    execCtx.waitUntil(env.CACHE.put(key, html, { expirationTtl: 2_592_000 }));
    return new Response(html, { status: 200, headers: HTML_HEADERS });
  }

  async function notFoundPage(c: any): Promise<Response> {
    const page = await expandSlug(c.env, c.executionCtx, "404");
    if (page) return new Response(page.body, { status: 404, headers: page.headers });
    return c.text("Not found", 404);
  }

  // Page catch-all — everything not matched above.
  app.get("*", async (c) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(c.req.url).pathname);
    } catch {
      return notFoundPage(c);
    }
    let slug = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();

    // *.html probes → clean canonical URL
    if (/^[a-z0-9-]+\.html$/.test(slug)) {
      const target = publicPath(slug.slice(0, -5));
      return c.redirect(target === "/index/" ? "/" : target, 301);
    }
    // known action routes tolerate trailing slashes and case differences
    if (slug === "download") return c.redirect("/download", 301);
    if (slug === "index") return c.redirect("/", 301);
    if (slug === "") slug = "index";

    if (!SLUGS.includes(slug)) return notFoundPage(c);
    const page = await expandSlug(c.env, c.executionCtx, slug);
    return page ?? notFoundPage(c);
  });

  app.notFound((c) => notFoundPage(c));

  return app;
}

export type AppType = ReturnType<typeof createApp>;

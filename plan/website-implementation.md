# Compressy Website — Implementation Plan

Marketing site for Compressy, built in [`website/`](../website). Hundreds of keyword-targeted landing pages are planned, so the core deliverable is a **framework**: hand-written classless HTML pages using `<e-*>` enhanced elements that expand into final designed HTML **on the fly at request time**, cached in KV.

- **Deploy target:** Cloudflare Workers (Hono) + Workers Static Assets + Workers KV
- **Toolchain:** **Bun** for everything local — package manager, scripts, tests
- **Design refs:** [`design/landing.html`](../design/landing.html) (page), 11 gallery files (element variant libraries), [`design/downloads.html`](../design/downloads.html) (next pass)
- **Domain:** `https://compressy.app`
- **Installer links:** `https://assets.compressy.app/{version}/Compressy-setup.exe` (R2)

---

## 0. Decisions (locked with user, 2026-08)

| Topic | Decision |
|---|---|
| `<e-*>` mechanism | **On-the-fly server-side expansion** per request, **KV-cached** to avoid repeat CPU |
| Templates | **Vanilla `.html` files** for elements + layout; interpolation = mustache tokens (`{{ }}` / `{{{trusted}}}`) executed by our expander. No Handlebars (eval/codegen risk) — rejected Lit/web components for SEO reasons (2026-08) |
| Interactivity | **Single Alpine entry**: `public/js/app.js` registers every element component via `alpine:init`; elements opt in with `x-data="name"`. Loads before alpine.min.js (both deferred) |
| Page location | Pages live at **`public/{slug}.html`** as raw authored files inside the deployed assets; never served raw (see §6 routing) |
| Publishing flow | **Git commit + deploy** (`wrangler deploy` seconds); no CMS/upload tooling |
| Runtime | Hono on Cloudflare Workers; static assets still served assets-first (free/unmetered) |
| v1 scope | Framework + landing page first; downloads page next pass |
| SEO | Full programmatic: canonical, OG/Twitter, sitemap.xml, robots.txt, auto-JSON-LD |
| Toolchain | Bun for install/test/dev tooling (production runtime is workerd via wrangler) |

---

## 1. Toolchain — Bun specifics

| Concern | Choice | Notes |
|---|---|---|
| Package manager | `bun install` | Lockfile `bun.lock` committed |
| Script runner | `bun run <task>` | No npm/npx anywhere |
| Tests | `bun test` (`bun:test`) | Expander unit tests + route tests via `hono/testing` `app.request()` with mocked bindings |
| Dev runtime | `bunx wrangler dev` | Local workerd + local KV simulation + assets binding — canonical dev loop |
| DOM parsing | linkedom | Pure JS, runs in workerd and Bun alike |
| Interpolation | mustache.js 4.x | Zero deps, no eval — workers-safe by construction |

No build step exists. The expander is a pure async function used identically by the Worker route and by tests.

## 2. Project layout

```
website/
├── package.json              # deps: hono, handlebars, linkedom · devDeps: wrangler, @cloudflare/workers-types, @types/bun
├── tsconfig.json             # editor support only
├── .gitignore                # node_modules/ .wrangler/
├── wrangler.jsonc            # main: worker/index.ts · assets → ./public · KV binding CACHE · text rules for src/**/*.html
├── public/                   # deployed verbatim as Static Assets
│   ├── index.html            # pages = public/{slug}.html — raw authored, expanded on the fly
│   ├── 404.html              # expanded through the same pipeline on the notFound path
│   ├── css/site.css          # tokens verbatim + all element styles
│   ├── favicon.ico           # from design/app.ico
│   ├── icon.png              # from design/icon.png
│   └── vendor/
│   ├── js/app.js             # single Alpine entry — all element components via alpine:init
│   └── vendor/
│       ├── htmx.min.js       # pinned 2.0.10, self-hosted
│       └── alpine.min.js     # pinned 3.16.2 (defer build), self-hosted
├── src/
│   ├── site.config.json      # single source of truth (§9)
│   ├── config.ts             # typed config + downloadUrl()
│   ├── expander.ts           # PURE expansion: e-* → final HTML (no fs, no I/O)
│   ├── meta.ts               # head-data extraction + resolution (title/desc/canonical/OG)
│   ├── jsonld.ts             # structured-data assembly from collected page data
│   ├── manifest.ts           # slug list for sitemap/robots (sync-tested against public/)
│   ├── elements/
│   │   ├── registry.ts       # imports element .html via wrangler Text rules; ElementDef map
│   │   └── *.html            # one vanilla-HTML partial per element
│   │   └── README.md         # authoring conventions (the framework contract)
│   └── layouts/base.html     # <html> shell: meta injection, nav, footer, {{{body}}}
├── worker/
│   ├── app.ts                # createApp({ ASSETS, CACHE }) — the Hono app (shared with tests)
│   └── index.ts              # entry: export default app wired to env bindings
└── test/
    ├── expand.test.ts        # expander unit tests (fixture elements registered inline)
    ├── routes.test.ts        # app.request() integration w/ mock ASSETS + mock KV
    └── fixtures/*.html       # tiny authored pages covering each element
```

## 3. Architecture

```mermaid
flowchart TD
  B[Browser] -->|/css/* /vendor/* favicon — asset match, free & unmetered| A[(Static Assets<br/>public/*)]
  B -->|/ , /{slug} , /{slug}.html — run_worker_first| W[Hono Worker<br/>worker/app.ts]
  W -->|"KV get rev:path"| K[(Workers KV)]
  K -->|hit ~1ms read, no CPU| W
  W -->|miss| S["env.ASSETS.fetch(/slug.html)<br/>raw authored source"]
  S --> X[expander.ts<br/>linkedom parse · registry mappers · mustache partials]
  X --> L[layouts/base.html<br/>meta · canonical · OG · JSON-LD]
  L -->|"waitUntil KV put, TTL 30d"| K
  L --> W --> B
```

Key properties:
- **Raw pages are never served.** `run_worker_first: ["/", "/*.html"]` sends every HTML-ish request to the Worker first; the Worker fetches sources through the internal ASSETS binding and returns only expanded output.
- **Non-HTML assets keep the free path** (assets-first routing, zero CPU, unmetered).
- **KV makes warm requests cheap**: cache hit is one fast read; expansion CPU is paid once per `(revision, page)`.

## 4. Authoring model

A page is one plain `.html` file at `public/{slug}.html`. Public URL = `/slug/` (canonical form). `index.html` serves `/`.

```html
<!doctype html>
<html lang="en">
<head>
  <title>Compress JPG Files Offline — Compressy</title>
  <meta name="description" content="Shrink JPG photos locally on Windows. No uploads, no account — batch-compress with mozjpeg-grade quality.">
  <!-- optional overrides -->
  <meta property="og:image" content="/og/compress-jpg.png">
</head>
<body>
  <e-hero pill="Free · Offline · Built for Windows"
          title="Compress JPG Files Without Uploading Them">
    <p slot="lead">Compressy shrinks JPG folders locally…</p>
    <a slot="actions" href="/download">Download for Windows</a>
    <span slot="proof"><em>−27%</em> avg saved</span>
  </e-hero>

  <e-steps variant="horizontal">
    <div><h3>Pick a folder</h3><p>The scanner finds every JPG recursively.</p></div>
    <div><h3>Compress</h3><p>Quality slider, threads 2/4/8, live per-file savings.</p></div>
    <div><h3>Done</h3><p>Overwrite in place with backups, or export a CSV.</p></div>
  </e-steps>

  <e-faq variant="accordion">
    <details><summary>Are my photos uploaded?</summary><p>No — compression runs entirely offline.</p></details>
    <details><summary>Is it free?</summary><p>Yes, free for Windows.</p></details>
  </e-faq>

  <e-cta variant="band" title="Compress your JPGs today." />
</body>
</html>
```

**Conventions (the contract, documented in `src/elements/README.md`):**

1. Elements are custom-tag **templates** — unknown attributes become context variables; children map by tag name or `slot="name"` attribute.
2. Default tag mapping per element (e.g. `h3`→title, `p`→body, first `svg`→icon, `li`→items, `<details>`→FAQ Q/A pair, `tr`→table rows).
3. `slot="…"` overrides any default mapping; slotted content may itself contain nested `<e-*>` (expanded depth-first, innermost first).
4. Self-closing elements use attributes-only props where sensible.
5. Bare semantic tags between elements get sensible section typography from the classless base layer (§7).

## 5. Element inventory (v1)

All variant designs come from the gallery files; demo wrappers (`demo-wrap`, `demo-label`) and inline styles become real element-scoped CSS.

| Element | Variants (attr) | Child mapping | Design source |
|---|---|---|---|
| `e-hero` | — | slots: lead/actions/proof; attrs: pill, title | landing hero |
| `e-mock` | rows via children | `mock-row path=… name=… size=… save=…` | landing mock |
| `e-button` | `variant=primary\|ghost size=sm` | wraps inner text/link | both designs |
| `e-pill` | `tone=default\|success` | text | pills |
| `e-card` | icon/title/body via children | h3/p/svg | `.card` atom |
| `e-cards` | `variant=icons\|rules\|rows cols=3\|4` | repeated `e-card` or li children | features 01–03, grids-01 |
| `e-bento` | spans via `span=2\|row2` on cells | cells | grids-03, features-03 |
| `e-stats` | `variant=rules\|strip\|bento\|row` | div children → value/label/note | stats 01–04, grids-02 |
| `e-steps` | `variant=horizontal\|timeline\|numbered\|icons` | div children → num/title/body | process 01–04 |
| `e-points` | `variant=checks\|cols\|numbered\|dots` | li children | points 01–04 |
| `e-split` | `variant=editor\|card\|alt\|narrow` | slots: copy/media/list | splits 01–04 |
| `e-faq` | `variant=accordion\|cards\|list\|compact` | `<details>` children | faqs 01–04 |
| `e-logos` | `variant=bar\|grid\|pills\|cluster` | svg/img/text children | logos 01–04 |
| `e-table` | `variant=savings\|matrix\|changelog\|pricing` | real `<table>` children | table 01–04 |
| `e-cta` | `variant=band\|split\|inline\|cards` | attrs title/sub; slot actions | call-to-actions 01–04 |
| `e-split` | `narrow\|card` | slots: list (slotOuter — semantic wrapper kept), card, media/copy | splits 01–04 |
| `e-content` | `variant=editorial` | prose children | content-01 |

Registry entry shape:

```ts
export interface ElementDef {
  templateName: string;                 // registered mustache partial
  mapper(node: Element, ctx: ExpandCtx): Record<string, unknown>;
  collect?(data: Record<string, unknown>, seo: SeoCtx): void;
}
```

## 6. Routing & serving model (`wrangler.jsonc` + worker)

```jsonc
{
  "name": "compressy-site",
  "main": "worker/index.ts",
  "compatibility_date": "2026-08-01",
  "kv_namespaces": [{ "binding": "CACHE", "id": "placeholder-local" }],
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    "not_found_handling": "none",
    "html_handling": "none",
    "run_worker_first": ["/", "/404.html", "/*.html"]
  },
  "rules": [{ "type": "Text", "globs": ["src/**/*.html"], "fallthrough": true }]
}
```

Why each flag exists:
- `html_handling: "none"` — kills the default extensionless→`.html` magic and `/`→`index.html` mapping that would otherwise serve raw pages before the worker sees them.
- `run_worker_first: ["/", "/404.html", "/*.html"]` — every HTML-shaped request hits the Worker first; direct `/foo.html` probes get expanded output, never raw markup.
- Everything else (`/css/*`, `/vendor/*`, icons) matches assets directly — free, unmetered, zero CPU.
- `rules` Text glob (`src/**/*.html`) ships element/layout templates into the bundle as string modules (they must not be publicly fetchable either).

Worker route table (`worker/app.ts`, exported `createApp(env)`):

| Route | Behavior |
|---|---|
| `GET /` | expand `index.html` |
| `GET /{slug}` / `/{slug}/` | expand `{slug}.html`; unknown slug → notFound path |
| `GET /{anything}.html` | 301 to clean URL `/{slug}/` (canonical form) |
| `GET /sitemap.xml` | generated from `manifest.ts` slugs |
| `GET /robots.txt` | Allow all + sitemap pointer |
| `GET /download` | 302 → `${assetsBase}/${version}/Compressy-setup.exe` |
| `GET /healthz` | `ok` |
| fallback / unmatched | expand `404.html` with status 404 |

Security headers (`X-Content-Type-Options`, `Referrer-Policy`) apply to worker responses. Asset-served responses bypass the worker by design (CF defaults apply there).

## 7. On-the-fly expansion + KV cache

Expansion pipeline per cold request:

1. Resolve slug → fetch raw source via `env.ASSETS.fetch("/"+slug+".html")`.
2. Compute page key: `${rev}:${path}:${sha256(source)}` — `rev` = `sha256(config + layout + all element partials + registry version)` computed once per isolate boot (lazy singleton promise). Including the per-page source hash means editing one page only invalidates its own entries.
3. KV `get(key)` → hit: return cached HTML immediately (~ms read, negligible CPU).
4. Miss: `parseHTML` (linkedom) → depth-first recursive `e-*` expansion via registry mappers → render vanilla-HTML partials through mustache → collect structured data (FAQ pairs, steps, breadcrumbs) → strip authored `<head>` → resolve meta (`title`/`description`/canonical `https://compressy.app/slug/`/OG/Twitter: page override > config default > derived) → render `base.html` with body + meta + JSON-LD blocks.
5. Respond with `Cache-Control: public, max-age=300`; `waitUntil(CACHE.put(key, html, { expirationTtl: 2592000 }))`.

Notes:
- Cold-miss races do redundant idempotent work — deliberately no locks.
- Any change to config/partials/layout bumps `rev` → old keys age out via TTL; per-page hash covers page edits.
- KV values capped at 25MB — pages are ~20KB, no concern.

**Auto-JSON-LD** harvested during expansion: `SoftwareApplication` + `WebSite` (from config), `FAQPage` (every `e-faq`), `HowTo` (every `e-steps`), `BreadcrumbList` (path-derived). Rendered as `application/ld+json` before `</body>`.

## 8. CSS strategy (`public/css/site.css`)

Unchanged from original plan: tokens ported verbatim (verified 56/56 identical), reset + classless base typography, one commented block per element reusing design classnames, breakpoints 1080/860/560, reduced-motion guard. htmx/Alpine vendored self-hosted; FAQ accordion is native `<details>` (JS-free).

## 9. Site config (`src/site.config.json`)

Unchanged: url, brand, version `1.4.2`, R2 downloads pattern, nav, SEO defaults. Version bumps propagate to CTAs, JSON-LD, and the `/download` redirect automatically.

## 10. Dev workflow

| Task | Command |
|---|---|
| Install | `bun install` |
| Canonical dev | `bun run dev` → `bunx wrangler dev` (local KV sim included) |
| Tests | `bun test` |
| Deploy | `bunx wrangler deploy` |

Editing a page or partial takes effect on next request after redeploy; locally, wrangler dev picks up `public/**` changes instantly and restarts on worker-source changes.

## 11. Verification plan

| Check | How |
|---|---|
| Expansion complete | `curl /` contains expanded classnames; **zero** `<e-` tags in any response |
| Raw-page leak guard | `curl /index.html` returns *expanded* HTML (worker-first), never raw source; `curl /pages/…` 404s |
| KV caching works | First request expands; second identical request served from cache (wrangler-dev KV inspector shows entry; response identical) |
| Meta complete | Unique title/description/canonical/OG per page |
| Structured data | All `ld+json` valid JSON; FAQPage mirrors rendered questions |
| Sitemap/robots | URLs list exactly the slugs in `public/*.html`; each resolves 200 |
| Free path intact | `/css/site.css`, `/vendor/htmx.min.js`, `/favicon.ico` 200 without worker involvement |
| Redirect | `/download` 302 to versioned R2 URL; `/foo.html` 301 to `/foo/` |
| Tests | `bun test`: expander fixtures, meta resolution order, JSON-LD harvesting, route integration with mock ASSETS/KV, manifest↔public sync |

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Raw unexpanded pages leak publicly (regression of routing flags) | E-test asserts `/{slug}.html` ≠ raw source; `html_handling:none` + `run_worker_first` documented in §6 |
| Stale cache after partial/config edit (incomplete rev hash) | Rev includes config + layout + every partial + registry version constant; per-page hash covers page edits; bump `REGISTRY_VERSION` when mapper logic changes |
| Cold-miss latency per PoP | Acceptable (~tens of ms); KV hit path is ~1 read; edge `max-age=300` absorbs bursts |
| Worker invocation cost scales with page traffic | Accepted tradeoff of on-the-fly model; static assets stay free-path |
| linkedom quirks with custom elements | Per-element fixtures in `bun test` from Phase B day one |
| Manifest ↔ public desync (sitemap wrong) | Sync unit test: every `manifest.ts` slug exists as `public/{slug}.html` and vice versa |
| Mustache escaping entity-encodes URLs/slashes in slots | Trusted HTML via triple-stache; mappers wrap trusted HTML in `SafeString`; raw-slot rule documented |
| KV namespace id placeholder until deploy | Local sim works with placeholder id; real id created at deploy time (E5 runbook) |

## 13. Out of scope (this pass)

- Downloads/changelog page (next pass via `e-table variant=changelog` + htmx release filtering)
- Remaining `content.html` variants (docs / explainer / knowledge-base)
- OG image generation, analytics, hreflang/i18n, keyword-page data pipeline

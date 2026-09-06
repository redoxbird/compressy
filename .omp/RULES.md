# Compressy — Project Rules (sticky)

Keep this file short. Background belongs in `.omp/AGENTS.md` or `website/src/elements/README.md`.

## website/public/*.html — Page Authoring (hard requirements)

- MUST be **classless**: NEVER use `class=` or `style=` in any `public/*.html` (enforced by `website/test/routes.test.ts` `not.toMatch(/\bclass\s*=/ )`). All styling lives in `public/css/site.css` via `e-*` wrappers; all interactivity in `public/js/app.js`.
- MUST use `e-*` elements for structure — NEVER raw `div` grids/cards. Variant via `variant="…"` per `website/src/elements/README.md` Element reference. Unknown variant MUST fallback to default; NEVER style in page.
- MUST keep manifest in sync: adding `public/{slug}.html` MUST also add `slug` to `website/src/manifest.ts` `SLUGS` (and vice versa, except `404`). `SLUGS` drives `sitemap.xml`/`robots.txt` and the sync test.
- MUST include unique `<title>` and `<meta name="description">` in `<head>`; body MUST be valid HTML5 (`<!doctype html><html lang="en"><head>…</head><body>…</body></html>`).
- MUST follow existing SEO page shape: `e-hero` (pill/title/lead/actions/meta/proof) → `e-mock` (mock-src/mock-out) → `e-section` blocks (`e-cards`/`e-steps`/`e-stats`/`e-table`/`e-points`/`e-faq`/`e-content`) → `e-cta variant="band"`; reuse design tokens from `design/*.html`, map via `website/src/elements/` (grids → `e-grid-feature`/`e-grid-proof`/`e-grid-dense`/`e-grid-bento`).
- MUST NOT invent a new `e-*` variant or element without: `src/elements/e-name.html` + `ElementDef` in `src/elements/index.ts` (import → `PARTIALS`) + CSS block in `public/css/site.css` + fixture in `website/test/elements.test.ts`.
- `website/public/sections.html` MUST showcase every element variant (one demo per variant); keep `e-demo-head` metadata accurate (`variant="…"` strings).
- MUST update `website/public/sitemap.xml` and `website/public/sitemap.html` whenever authoring/renaming/removing a page (any `SLUGS`/`public/*.html` change). `sitemap.xml` is the crawler source served by the `assets` binding (NOT the worker `/sitemap.xml` route — the worker route only answers dynamic `{site.url}{publicPath}` URLs to pages in `SLUGS`; keep the static `public/sitemap.xml` in sync for the crawler). `sitemap.html` is the human index. Sync both to the new `SLUGS` count — bump the `28 pages`/`28 slugs` proofs in `sitemap.html` and add/remove its cards.

## SEO pages — unique structure (hard requirements)

- SEO pages MUST be distinct in **structure**, not only in copy/text. Same copy in a different template is still a thin page; crawlers and readers both see near-duplicates.
- Vary the element **variants** per page — drawn from `website/src/elements/README.md` Element reference. Do NOT use one fixed template for every page. Currently the default is `e-cards variant="icons"` + `e-table variant="matrix"` + `e-steps variant="horizontal"` + `e-faq variant="accordion"` on every slug; rotate and combine instead.
- Use the breadth of the library. Among the variants available (README reference): `e-cards icons|rules|rows`, `e-table savings|matrix|changelog|pricing`, `e-steps horizontal|timeline|numbered|icons`, `e-stats rules|strip|bento|row`, `e-faq accordion|cards|list|compact`, `e-points checks|cols|numbered|dots`, `e-logos bar|grid|pills|cluster`, `e-split narrow|card|editor|alternating|content-card`, `e-cta band|split|inline|cards`, `e-content editorial|docs|explainer|kb`, plus `e-bento`, `e-progress-line`, `e-example`, `e-pill`, `e-button primary|ghost`, and the `e-grid-feature|grid-proof|grid-dense` grids. Pick a composition that fits the page's intent, not a copy-paste skeleton.
- The SEO corpus as a whole MUST exercise every registered element/variant (`website/public/` + `website/src/elements/` `README.md` reference), so nothing added to the library goes unused by published pages. `sections.html` already showcases each variant once — that is the floor; SEO pages should rotate real usage across the corpus so no variant lives only in the demo.
- Two directly-sibling SEO pages (adjacent slugs, same cluster) MUST NOT use the identical block sequence + variant set. When authoring a page, look at the sibling pages in the same cluster and shift at least the section order and 2+ variant choices.
- Prefer the richer elements where they fit: `e-stats bento|row`, `e-bento` grid for metrics, `e-split alternating` for feature/copy rhythm, `e-points numbered|checks` for step lists, `e-logos cluster|grid` for client/format logos, `e-content explainer|kb|docs` for long-form format/guide pages over a plain `e-cards` wall.
- This applies to NEW authoring going forward; already-published pages stay as-is unless a rewrite is requested.

## Commit discipline

- NEVER auto-commit. Do NOT run `git commit`/`git push`/`git add` (staging) unless the user explicitly asks. Report changes and await instruction.

## General

- `design/*.html` is source of truth for visual variants — port verbatim tokens, do not redesign.
- Bump `website/src/elements/registry.ts` `REGISTRY_VERSION` when mapper logic changes invisible to rev hash.

# Compressy element library — authoring contract

Pages are **classless vanilla HTML**. Structure comes from `<e-*>` elements;
all styling lives in `public/css/site.css`; all interactivity is registered in
`public/js/app.js` (single Alpine entry). This file is the contract for
writing pages and adding elements.

```html
<e-cards variant="icons">
  <e-card>
    <svg viewBox="0 0 16 16" fill="none"><!-- icon --></svg>
    <h3>No uploads.</h3>
    <p slot="body">Files stay in your folder.</p>
  </e-card>
</e-cards>
```

## Rendering model

- The Hono worker expands every registered `<e-*>` tag **server-side**, on the
  fly, and caches the result in KV. Crawlers receive complete HTML.
- Expansion is **depth-first, innermost first**: nested elements resolve before
  their parents render, so wrappers see final markup.
- Interpolation uses mustache tokens inside each element's `.html` template
  (`{{escaped}}` / `{{{trusted-html}}}`) — an implementation detail of
  templates, never visible in authored pages.
- Unknown `<e-*>` tags are left untouched in the output — a visible signal that
  something isn't registered.

## Authoring conventions

### Attributes choose variants

Every structural element takes a `variant` attribute (values listed per element
below). Unknown variants fall back to the default.

### Children map by tag or slot

| Mapper reads | Authored as |
|---|---|
| title | first direct `<h1>`/`<h2>`/`<h3>` — or a `title="…"` attribute |
| body / lead / actions / proof … | child with `slot="<name>"` (trusted HTML) |
| icon | first direct `<svg>` (embedded whole via `outer()`) |
| items | semantic children: `li` for points, `<details>` for faq, `<table>` for tables |

`slot=` children are consumed by their element and removed from output.

### Data-only child tags

Some parents consume dedicated child tags for structure. These are **not**
registered themselves — the parent's mapper reads them:

| Parent | Child | Attributes |
|---|---|---|
| `e-stats` | `e-stat` | `value`, `label`, `note?`, `bar?` (0–100 width) |
| `e-steps` | `e-step` | `title`, `label?`, `meta?`; body = innerHTML |
| `e-mock` | `mock-src` | `name`, `ext`(jpg/png/webp/avif), `size`, `check="(false)"` |
| `e-mock` | `mock-out` | `name`, `ext`, `dims`, `save` |
| `e-hero` | `e-proof` | `value`, `label`, `success` (flag) — dots auto-inserted |
| `e-bento` | `e-cell` | `eyebrow?`, `chip?`, `span?` (2/tall), `dark`; body = innerHTML |

### The classless rule

**Authored pages must contain zero `class=` and zero `style=` attributes.**
This is enforced by a test over every page listed in the manifest. If a design
needs a new shape, extend an element or add one — never style in the page.

## Element reference

| Element | Variants (`variant=`) | Notes |
|---|---|---|
| `e-section` | — | attrs: `id`, `warm`, `eyebrow`, `title`; slot: `lead`; children = body content. Replaces section/container/head boilerplate |
| `e-pill` | tone: `default`\|`success` | inline badge |
| `e-button` | `primary`\|`ghost`; `size=sm` | attrs: `href`; label = innerHTML |
| `e-card` | — | svg + h3 + p/body-slot; `type="format"` renders a badge-card (`badge`, `hint` attrs) |
| `e-hero` | — | attrs: `pill`, `title`; slots: lead/actions/meta; children: `e-proof` items (legacy proof slot still supported) |
| `e-mock` | `default`\|`app` | `default` preview mock; `app` full window chrome with toolbar/grid/search; attrs: path/count/selected/saved/note*/caption |
| `e-cards` | `icons`\|`rules`\|`rows`; `cols=2..4`; children may be `e-card type="format"` | variant class omitted when unspecified |
| `e-bento` | `cols=2\|4` | cells: structured `e-cell`s or bare articles (`span=2`/`tall`, `dark`) |
| `e-stats` | `rules`\|`strip`\|`bento`\|`row` | strip: negative values render green |
| `e-steps` | `horizontal`\|`timeline`\|`numbered`\|`icons` | `footnote=` centered fine print; `howto="Name"` emits HowTo JSON-LD |
| `e-points` | `checks`\|`cols`\|`numbered`\|`dots` | li: plain text or `<strong>lead</strong> rest` |
| `e-logos` | `bar`\|`grid`\|`pills`\|`cluster` | caption attr; children rendered as-is |
| `e-faq` | `accordion`\|`cards`\|`list`\|`compact` | accordion = native details; always emits FAQPage JSON-LD |
| `e-table` | `savings`\|`matrix`\|`changelog`\|`pricing` | authors write a real `<table>`; th `align=right` honored |
| `e-cta` | `band`\|`split`\|`inline`\|`cards` | attrs: pill/sub/meta/title; slots: sub/actions |
| `e-split` | `narrow`\|`card`\|`editor`\|`alternating`\|`content-card` | slots: list/media (element kept via slotOuter), card/copy; `editor` 1fr 1fr preview, `alternating` media+copy, `content-card` 1fr 360px |
| `e-progress-line` | — | attrs: `label?`, `value`, `fill?`, `caption` — generic meter row (auto-fill from 40–95 numeric values) |
| `e-example` | — | attrs: `file`, `before`, `after`, `save` — mono before→after row |
| `e-note` | — | attr: `center`; text = innerHTML — muted fine print |
| `e-content` | `editorial`\|`docs`\|`explainer`\|`kb` | `editorial` long-form guide; `docs` sidebar 240px + toc + prose + callout; `explainer` stats+table comparison; `kb` search + grouped guides |
| `e-releases` | — | full release list from `releases` data: featured first, notes groups, assets, SHA rows |
| `e-release-filter` | — | search + tag chips; filtering handled by delegated handlers in `app.js` |

### Data-driven elements

Elements read structured content from JSON files in `public/data/*.json`.
Files are preloaded via the assets binding once per isolate and exposed as
`ctx.data.<name>` to mappers; their JSON is part of the KV cache revision, so
editing a data file invalidates dependent pages on redeploy.

| Data file | Consumed by |
|---|---|
| `data/releases.json` | `e-releases`, `e-release-hero`, `/download` redirect (latest installer) |

Internal partials (no registered tag): `e-bento-cell` — rendered by the bento
mapper via `api.render(name, data)`.

## Adding a new element

1. Create `src/elements/e-name.html` — vanilla HTML + mustache tokens.
2. Add its `ElementDef` to `PROD_DEFS` in `src/elements/index.ts`
   (`templateName` must equal `"e-name"`); import the file into `PARTIALS`.
3. Append an element CSS block to `public/css/site.css` (reuse design tokens;
   add responsive collapses to the existing media queries).
4. If interactive, register an Alpine component in `public/js/app.js` under
   `alpine:init` and reference it from the template via `x-data="<name>"`.
5. Add a fixture test in `test/elements.test.ts`.

Bumping `REGISTRY_VERSION` in `registry.ts` invalidates all cached pages after
mapper-logic changes (template/config edits are hashed automatically).

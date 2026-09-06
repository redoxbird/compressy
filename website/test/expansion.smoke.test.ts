import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expandPage } from "../src/expander";
import { createRegistry } from "../src/elements/registry";
import { PROD_DEFS, PARTIALS } from "../src/elements/index";
import { site } from "../src/config";

const registry = createRegistry(PROD_DEFS, PARTIALS);
const ctx = { slug: "sections", path: "/sections/", site };

describe("sections library expansion smoke", () => {
  test("public/sections.html expands without errors", () => {
    const src = readFileSync(join(import.meta.dir, "..", "public", "sections.html"), "utf8");
    const r = expandPage(src, ctx, registry);
    // No leftover unknown e-* tags (everything authored is registered)
    const leftover = r.body.match(/<e-[a-z][a-z0-9-]*[\s>]/g) ?? [];
    expect(leftover).toEqual([]);
  });

  test("public/index.html expands without errors", () => {
    const src = readFileSync(join(import.meta.dir, "..", "public", "index.html"), "utf8");
    const r = expandPage(src, ctx, registry);
    const leftover = r.body.match(/<e-[a-z][a-z0-9-]*[\s>]/g) ?? [];
    expect(leftover).toEqual([]);
  });

  test("public/downloads.html expands without errors", () => {
    const src = readFileSync(join(import.meta.dir, "..", "public", "downloads.html"), "utf8");
    const r = expandPage(src, ctx, registry);
    const leftover = r.body.match(/<e-[a-z][a-z0-9-]*[\s>]/g) ?? [];
    expect(leftover).toEqual([]);
  });

  test("design fixes present in sections.html expansion", () => {
    const src = readFileSync(join(import.meta.dir, "..", "public", "sections.html"), "utf8");
    const r = expandPage(src, ctx, registry);
    // e-faq list variant emits mono numerals (faq-03 demo)
    expect(r.body).toContain("faq__num");
    // e-cta split meta rendered inside .cta__panel (cta-02 demo)
    expect(r.body).toContain("cta__panel");
    // statstrip__item class is gone (audit fix)
    expect(r.body).not.toContain("statstrip__item");
    // unstyled content wrapper classes removed
    expect(r.body).not.toContain("content--editorial");
    // e-grid-feature no longer forces cards--icons (e-cards variant=icons is unrelated)
    // e-grid-feature without explicit variant renders without dead cards--icons
    // (sections.html uses e-grid-feature for grids 01/04 with no variant attribute)
    const gridFeatureTagCount = (r.body.match(/<e-grid-feature[\s>]/g) ?? []).length;
    expect(gridFeatureTagCount).toBe(0);
    // asset__icon--empty is gone
    expect(r.body).not.toContain("asset__icon--empty");
  });

  // Pin fixes from REGISTRY_VERSION 9 — both regressions were caught by visual audit
  // (BrowserOS neo on /sections/) but are invisible to the rev hash, so the cache bump
  // is the only signal that deployed workers will pick them up.
  test("e-content title renders once (not duplicated into prose)", () => {
    const r = expandPage(
      `<body><e-content eyebrow="Guide">
        <h2>Shrink a 20 MB portfolio without losing a pixel</h2>
        <p slot="lead">Lead line.</p>
        <p>Body one.</p>
        <h3>Section</h3>
        <p>Body two.</p>
      </e-content></body>`,
      ctx,
      registry,
    );
    const matches = r.body.match(/Shrink a 20 MB portfolio without losing a pixel/g) ?? [];
    expect(matches.length).toBe(1);
  });

  test("e-points cols variant prints each li body exactly once", () => {
    const r = expandPage(
      `<body><e-points variant="cols">
        <li><strong>Offline</strong> Your images never leave your computer.</li>
        <li><strong>Workflow</strong> Select → Compress → Done.</li>
      </e-points></body>`,
      ctx,
      registry,
    );
    // Each tail phrase must appear once, not twice (the dedup regression printed it
    // once as the strong-stripped textContent AND once as the cloned body).
    expect(r.body.match(/Your images never leave your computer\./g)?.length ?? 0).toBe(1);
    expect(r.body.match(/Select → Compress → Done\./g)?.length ?? 0).toBe(1);
  });
});

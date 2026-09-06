import { describe, expect, test } from "bun:test";
import { createRegistry, type ElementDef } from "../src/elements/registry";
import { expandPage } from "../src/expander";
import { extractMeta, resolveMeta } from "../src/meta";
import { buildJsonLd } from "../src/jsonld";
import { site } from "../src/config";

// ── fixture elements ──────────────────────────────────────────────
const PARTIALS = {
  "e-pill": `<span class="pill pill--{{tone}}">{{text}}</span>`,
  "e-card": `<div class="card"><div class="card__icon">{{{icon}}}</div><h3>{{title}}</h3><p>{{{body}}}</p></div>`,
  "e-faqitem": `<details class="faq__item"><summary>{{q}}</summary><p>{{a}}</p></details>`,
  "e-box": `<section class="box">{{{inner}}}</section>`,
};

const DEFS: ElementDef[] = [
  {
    templateName: "e-pill",
    mapper: (api) => ({ tone: api.attrs().tone ?? "default", text: api.text() }),
  },
  {
    templateName: "e-card",
    mapper: (api) => ({
      icon: api.outer("svg") ?? "",
      title: api.child("h3") ?? "",
      body: api.slot("body") ?? "",
    }),
  },
  {
    templateName: "e-faqitem",
    mapper: (api) => ({
      q: api.child("summary") ?? "",
      a: api.slot("answer") ?? "",
    }),
    collect: (data, seo) => seo.addFaq(String(data.q), String(data.a)),
  },
  {
    // passthrough wrapper — proves nested e-* expand before the parent renders
    templateName: "e-box",
    mapper: (api) => ({ inner: api.node.innerHTML }),
  },
];

const registry = createRegistry(DEFS, PARTIALS);
const ctx = { slug: "test", path: "/test/", site };

function expand(src: string) {
  return expandPage(src, ctx, registry);
}

// ── expansion ─────────────────────────────────────────────────────
describe("expandPage", () => {
  test("expands an element and removes its tag", () => {
    const r = expand(`<body><e-pill tone="success">−27%</e-pill></body>`);
    expect(r.body).toContain(`class="pill pill--success"`);
    expect(r.body).toContain("−27%");
    expect(r.body).not.toContain("<e-");
  });

  test("expands nested elements deepest-first", () => {
    const r = expand(`<body><e-box><e-pill>inside</e-pill></e-box></body>`);
    expect(r.body).toContain(`class="box"`);
    expect(r.body).toContain(`class="pill pill--default"`);
    expect(r.body).toContain("inside");
    expect(r.body).not.toContain("<e-");
  });

  test("maps children by tag and slot", () => {
    const r = expand(
      `<body><e-card><svg viewBox="0 0 16 16"></svg><h3>No uploads.</h3><p slot="body">Files stay local.</p></e-card></body>`,
    );
    expect(r.body).toContain("<h3>No uploads.</h3>");
    expect(r.body).toContain(`card__icon"><svg viewBox="0 0 16 16"`);
    expect(r.body).toContain("<p>Files stay local.</p>");
    expect(r.body).not.toContain("slot=");
  });

  test("collect() harvests structured data for JSON-LD", () => {
    const r = expand(
      `<body><e-faqitem><summary>Are my photos uploaded?</summary><p slot="answer">No.</p></e-faqitem></body>`,
    );
    expect(r.collected.faqs).toEqual([{ q: "Are my photos uploaded?", a: "No." }]);
  });

  test("unknown e-* elements are left untouched (visible signal)", () => {
    const r = expand(`<body><e-nonexistent>hi</e-nonexistent></body>`);
    expect(r.body).toContain("<e-nonexistent>");
  });

  test("extracts authored head meta before mutation", () => {
    const r = expand(
      `<html><head><title>T — Compressy</title><meta name="description" content="D"></head><body></body></html>`,
    );
    expect(r.meta.title).toBe("T — Compressy");
    expect(r.meta.description).toBe("D");
  });
});

// ── meta resolution ───────────────────────────────────────────────
describe("resolveMeta", () => {
  test("authored values win over defaults", () => {
    const m = resolveMeta("index", { title: "T", description: "D" }, site);
    expect(m.title).toBe("T");
    expect(m.canonical).toBe(`${site.url}/`);
  });

  test("derived fallbacks + canonical per slug", () => {
    const m = resolveMeta("compress-jpg", {}, site);
    expect(m.title).toBe(`${site.brand.name} — ${site.brand.tagline}`);
    expect(m.description).toBe(site.brand.tagline);
    expect(m.canonical).toBe(`${site.url}/compress-jpg/`);
    expect(m.ogImage).toBe(`${site.url}${site.seo.defaultOgImage}`);
  });
});

// ── jsonld ────────────────────────────────────────────────────────
describe("buildJsonLd", () => {
  test("always emits WebSite + SoftwareApplication; FAQPage only when faqs exist", () => {
    const base = buildJsonLd({ site, collected: { faqs: [], howtos: [] }, slug: "index" });
    const types = base.map((b) => (b as { "@type": string })["@type"]);
    expect(types).toEqual(["WebSite", "SoftwareApplication"]);

    const withFaq = buildJsonLd({
      site,
      collected: { faqs: [{ q: "Q?", a: "A" }], howtos: [] },
      slug: "index",
    });
    expect(withFaq.map((b) => (b as { "@type": string })["@type"])).toContain("FAQPage");

    const withSteps = buildJsonLd({
      site,
      collected: { faqs: [], howtos: [{ name: "N", steps: [{ name: "S1", text: "T1" }] }] },
      slug: "x",
    });
    expect(withSteps.map((b) => (b as { "@type": string })["@type"])).toContain("HowTo");

    const sub = buildJsonLd({ site, collected: { faqs: [], howtos: [] }, slug: "compress-jpg", title: "T" });
    const crumb = sub.find((b) => (b as { "@type": string })["@type"] === "BreadcrumbList") as {
      itemListElement: Array<{ name: string }>;
    };
    expect(crumb.itemListElement.map((i) => i.name)).toEqual(["Compressy", "T"]);

    for (const b of [...base, ...withFaq, ...withSteps]) {
      expect(() => JSON.parse(JSON.stringify(b))).not.toThrow();
    }
  });
});

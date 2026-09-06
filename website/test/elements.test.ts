import { describe, expect, test } from "bun:test";
import { PARTIALS, PROD_DEFS } from "../src/elements";
import { createRegistry } from "../src/elements/registry";
import { expandPage } from "../src/expander";
import { site } from "../src/config";

const registry = createRegistry(PROD_DEFS, PARTIALS);
const ctx = { slug: "test", path: "/test/", site };

function ex(body: string) {
  return expandPage(
    `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`,
    ctx,
    registry,
  );
}

describe("atoms", () => {
  test("e-pill tones", () => {
    const r = ex(`<e-pill>default</e-pill><e-pill tone="success">ok</e-pill>`);
    expect(r.body).toContain(`pill pill--default">default`);
    expect(r.body).toContain(`pill pill--success">ok`);
  });

  test("e-button variants and href", () => {
    const r = ex(`<e-button variant="ghost" size="sm" href="/x">Label</e-button>`);
    expect(r.body).toContain(`<a class="btn btn-ghost btn-sm" href="/x">Label</a>`);
  });

  test("e-card icon/title/body", () => {
    const r = ex(
      `<e-card><svg viewBox="0 0 8 8"></svg><h3>T</h3><p slot="body">B</p></e-card>`,
    );
    expect(r.body).toContain(`card__icon" aria-hidden="true"><svg viewBox="0 0 8 8"`);
    expect(r.body).toContain("<h3>T</h3>");
    expect(r.body).toContain("<p>B</p>");
  });
});

describe("hero + mock", () => {
  test("e-hero slots render into hero chrome", () => {
    const r = ex(
      `<e-hero pill="P" title="Big<br>Title"><p slot="lead">L</p><span slot="proof"><em>x</em></span></e-hero>`,
    );
    expect(r.body).toContain(`class="pill hero__pill">P`);
    expect(r.body).toContain("<h1>Big<br>Title</h1>");
    expect(r.body).toContain(`lead hero__lead">L`);
    expect(r.body).toContain(`hero__proof`);
    // attribute title also works without an authored <h1>
    const r2 = ex(`<e-hero title="Attr">x</e-hero>`);
    expect(r2.body).toContain("<h1>Attr</h1>");
  });

  test("e-mock builds rows from data children", () => {
    const r = ex(
      `<e-mock path="C:\\img" saved="−4 MB saved">
        <mock-src check name="a.jpg" ext="jpg" size="3 MB"></mock-src>
        <mock-src name="b.png" ext="png" check="false" size="1 MB"></mock-src>
        <mock-out name="a.jpg" ext="jpg" dims="800×600" save="−27%"></mock-out>
      </e-mock>`,
    );
    expect(r.body).toContain("C:\\img");
    expect(r.body).toContain(`mock__check on">✓`);
    expect(r.body).toContain(`mock__icon jpg">JPG`);
    expect(r.body).toContain(`mock__icon png">PNG`);
    expect(r.body).toContain(`mock__save">−27%`);
    expect(r.body).toContain(`mock__saved">−4 MB saved`);
    // unchecked row: no .on class on its checkbox
    const unchecked = r.body.indexOf("b.png");
    expect(r.body.slice(unchecked - 200, unchecked)).not.toContain('mock__check on');
  });
});

describe("grids", () => {
  test("e-cards wraps expanded e-card children", () => {
    const r = ex(
      `<e-cards variant="icons" cols="4">
        <e-card><h3>A</h3><p slot="body">a</p></e-card>
        <e-card><h3>B</h3><p slot="body">b</p></e-card>
      </e-cards>`,
    );
    expect(r.body).toContain(`cards cards--icons cols-4">`);
    expect((r.body.match(/<article class="card">/g) ?? []).length).toBe(2);
  });

  test("e-cards omits variant class when not specified", () => {
    const r = ex(
      `<e-cards cols="4"><e-card type="format" badge="jpg" hint="m"><p slot="body">x</p></e-card></e-cards>`,
    );
    expect(r.body).toContain(`cards cols-4">`);
  });

  test("e-bento annotates span/dark cells", () => {
    const r = ex(
      `<e-bento>
        <div span="2" dark><h3>Wide</h3><p>x</p></div>
        <div><h3>Small</h3><p>y</p></div>
      </e-bento>`,
    );
    expect(r.body).toContain(`bento__cell bento__cell--wide bento__cell--dark`);
    expect(r.body).toContain(`<div class="bento__cell"><div>`);
    expect(r.body).not.toContain("<e-bento>");
  });
});

describe("grid aliases (design/grids.html compliance)", () => {
  test("e-grid-feature wraps cards without unstyled icons default", () => {
    const r = ex(
      `<e-grid-feature>
        <e-card><h3>A</h3><p slot="body">a</p></e-card>
        <e-card><h3>B</h3><p slot="body">b</p></e-card>
      </e-grid-feature>`,
    );
    expect(r.body).toContain(`cards cols-3">`);
    expect(r.body).not.toContain("cards--icons");

    expect((r.body.match(/<article class="card">/g) ?? []).length).toBe(2);
    expect(r.body).not.toContain("<e-grid-feature>");
  });
  test("e-grid-proof renders stats row by default", () => {
    const r = ex(
      `<e-grid-proof>
        <e-stat value="18.4 MB" label="Folder size" note="Across 12 images"></e-stat>
        <e-stat value="−27%" label="Avg saved" note="Peak −41%"></e-stat>
      </e-grid-proof>`,
    );
    expect(r.body).toContain(`stats stats--row`);
    expect(r.body).toContain(`18.4 MB`);
    expect(r.body).not.toContain("<e-grid-proof>");
  });
  test("e-grid-bento annotates bento cells", () => {
    const r = ex(
      `<e-grid-bento><e-cell dark eyebrow="F" chip="C"><h3>T</h3><p>x</p></e-cell><e-cell><h3>U</h3></e-cell></e-grid-bento>`,
    );
    expect(r.body).toContain(`bento bento--cols-2`);
    expect(r.body).toContain(`bento__cell--dark`);
    expect(r.body).not.toContain("<e-grid-bento>");
  });
  test("e-grid-dense wraps cards cols-3 without variant", () => {
    const r = ex(`<e-grid-dense><e-card><h3>A</h3><p slot="body">a</p></e-card></e-grid-dense>`);
    expect(r.body).toContain(`cards cols-3">`);
    expect(r.body).not.toContain("<e-grid-dense>");
  });
});

describe("demo-head + gap (section-library)", () => {
  test("e-demo-head renders demo-label with num/title/meta and hairline", () => {
    const r = ex(`<e-demo-head num="01" title="Feature grid — 3-col" meta="e-grid-feature · cards · 12px · warm"></e-demo-head>`);
    expect(r.body).toContain(`demo-head`);
    expect(r.body).toContain(`demo-head__num">01`);
    expect(r.body).toContain(`Feature grid`);
    expect(r.body).toContain(`demo-head__meta">e-grid-feature`);
    expect(r.body).toContain(`demo-head__rule`);
    expect(r.body).not.toContain("<e-demo-head");
  });
  test("e-gap renders spacer with size modifier", () => {
    const r = ex(`<e-gap size="lg"></e-gap>`);
    expect(r.body).toContain(`class="gap gap--lg"`);
    expect(r.body).not.toContain("<e-gap");
  });
  test("e-gap without size renders base gap", () => {
    const r = ex(`<e-gap></e-gap>`);
    expect(r.body).toContain(`class="gap"`);
    expect(r.body).not.toContain("gap--");
  });
});

describe("stats", () => {
  test("rules variant renders stat items", () => {
    const r = ex(
      `<e-stats variant="rules">
        <e-stat value="−27%" label="Avg saved" note="Peak −41%"></e-stat>
        <e-stat value="1000" label="Images"></e-stat>
      </e-stats>`,
    );
    expect(r.body).toContain(`stats stats--rules`);
    expect(r.body).toContain(`stat__value">−27%`);
    expect(r.body).toContain(`stat__label">Avg saved`);
  });

  test("strip variant renders inline proof with success values", () => {
    const r = ex(
      `<e-stats variant="strip">
        <e-stat value="18.4 MB" label="folder"></e-stat>
        <e-stat value="−4.2 MB" label="saved"></e-stat>
      </e-stats>`,
    );
    expect(r.body).toContain(`statstrip`);
    expect(r.body).toContain(`<em class="strong">18.4 MB</em> folder`);
    expect(r.body).toContain(`<em class="success">−4.2 MB</em> saved`);
  });
});

describe("steps", () => {
  test("horizontal renders numbered cards; HowTo opt-in via howto attr", () => {
    const r = ex(
      `<e-steps variant="numbered" howto="How to compress images">
        <e-step title="Select">Pick a folder.</e-step>
        <e-step title="Compress">Run locally.</e-step>
      </e-steps>`,
    );
    expect(r.body).toContain(`steps steps--numbered`);
    expect(r.body).toContain(`step__num">01`);
    expect(r.collected.howtos[0]?.name).toBe("How to compress images");
    expect(r.collected.howtos[0]?.steps[0]).toEqual({ name: "Select", text: "Pick a folder." });
  });

  test("no HowTo without the howto attribute", () => {
    const r = ex(
      `<e-steps><e-step title="A">x</e-step></e-steps>`,
    );
    expect(r.collected.howtos.length).toBe(0);
  });
});

describe("points", () => {
  test("checks and numbered marks", () => {
    const r = ex(
      `<e-points variant="checks"><li>No account.</li></e-points>` +
        `<e-points variant="numbered"><li><strong>Free.</strong> Offline.</li></e-points>`,
    );
    expect(r.body).toContain(`aria-hidden="true">✓`);
    expect(r.body).toContain(`aria-hidden="true">01`);
    expect(r.body).toContain("<strong>Free.</strong>");
  });
});

describe("faq", () => {
  test("accordion renders details and collects FAQPage pairs", () => {
    const r = ex(
      `<e-faq variant="accordion">
        <details><summary>Q one?</summary><p>A one.</p></details>
        <details><summary>Q two?</summary><p>A two.</p></details>
      </e-faq>`,
    );
    expect(r.body).toContain("<details");
    expect(r.collected.faqs).toEqual([
      { q: "Q one?", a: "A one." },
      { q: "Q two?", a: "A two." },
    ]);
  });

  test("cards/list variants render div items instead of details", () => {
    const r = ex(
      `<e-faq variant="cards"><details><summary>Q?</summary><p>A.</p></details></e-faq>`,
    );
    expect(r.body).not.toContain("<details");
    expect(r.body).toContain(`faq--cards`);
  });
});

describe("table", () => {
  test("savings variant maps semantic table to mono grid", () => {
    const r = ex(
      `<e-table variant="savings">
        <table>
          <thead><tr><th>File</th><th>Before</th><th align="right">Saved</th></tr></thead>
          <tbody>
            <tr><td>a.jpg</td><td>3.4 MB</td><td>−27%</td></tr>
          </tbody>
        </table>
      </e-table>`,
    );
    expect(r.body).toContain(`dtable dtable--savings`);
    expect(r.body).toContain(`mono">3.4 MB`);
    expect(r.body).toContain(`class="align-right mono">−27%`);
    expect(r.collected.faqs.length).toBe(0);
  });
});

describe("cta", () => {
  test("band variant renders only the band section", () => {
    const r = ex(
      `<e-cta variant="band" pill="Free" meta="Win 10+">
        <h2>Go.</h2>
        <p slot="sub">Sub copy.</p>
        <span slot="actions"><e-button href="/download">Get it</e-button></span>
      </e-cta>`,
    );
    expect(r.body).toContain(`cta cta--band`);
    expect(r.body).not.toContain("cta--split");
    expect(r.body).toContain(`cta__meta">Win 10+`);
    expect(r.body).toContain(`btn btn-primary" href="/download">Get it`);
  });
});

describe("classless extraction elements", () => {
  test("e-section renders shell, head, and passes body through", () => {
    const r = ex(
      `<e-section id="x" warm eyebrow="Local" title="Head<br>line"><p slot="lead">Intro.</p><p>Body one.</p><e-pill>t</e-pill></e-section>`,
    );
    expect(r.body).toContain(`<section class="section section--warm" id="x">`);
    expect(r.body).toContain(`eyebrow"><i></i> Local`);
    expect(r.body).toContain("<h2>Head<br>line</h2>");
    expect(r.body).toContain(`lead">Intro.`);
    expect(r.body).toContain("<p>Body one.</p>");
    expect((r.body.match(/<p class="pill/g) ?? []).length).toBe(0);
    expect(r.body).toContain(`pill pill--default">t`);
  });

  test("e-section without head props skips section__head", () => {
    const r = ex(`<e-section><p>Only content.</p></e-section>`);
    expect(r.body).not.toContain("section__head");
    expect(r.body).toContain("<p>Only content.</p>");
  });

  test("e-card type=format renders badge-card without icon/title chrome", () => {
    const r = ex(
      `<e-cards cols="4">
        <e-card type="format" badge="jpg" hint="mozjpeg"><p slot="body">J text</p></e-card>
        <e-card type="format" badge="avif" hint="next-gen"><p slot="body">A text</p></e-card>
      </e-cards>`,
    );
    expect(r.body).toContain(`cards cols-4">`);
    expect(r.body).toContain(`card card--format">`);
    expect(r.body).toContain(`format-badge">JPG`);
    expect(r.body).toContain(`format-badge avif">AVIF`);
    expect(r.body).toContain(`card__hint">mozjpeg`);
    expect(r.body).toContain("<p>J text</p>");
    // no icon area / empty h3 on format cards
    expect((r.body.match(/<h3><\/h3>/g) ?? []).length).toBe(0);
  });

  test("e-progress-line: explicit fill, computed fill, label optional", () => {
    const r = ex(`<e-progress-line value="85"></e-progress-line>`);
    expect(r.body).toContain('style="width:');
    expect(r.body).toContain(`aria-label="85"`);
    const explicit = ex(
      `<e-progress-line label="Quality" value="85" fill="68" caption="Cap."></e-progress-line>`,
    );
    expect(explicit.body).toContain(`progress-line__label">Quality`);
    expect(explicit.body).toContain('style="width:68%"');
    expect(explicit.body).toContain(`small muted">Cap.`);
  });

  test("hero proof items render with dots and success tone", () => {
    const r = ex(
      `<e-hero title="T">
        <e-proof value="18.4 MB" label="folder"></e-proof>
        <e-proof value="−4.2 MB" label="saved" success></e-proof>
      </e-hero>`,
    );
    expect(r.body).toContain(`<em class="strong">18.4 MB</em> folder`);
    expect(r.body).toContain(`<em class="success">−4.2 MB</em> saved`);
    // trailing separator trimmed by CSS; markup keeps dots between items only
    expect((r.body.match(/<i class="dot"><\/i>/g) ?? []).length).toBe(2);
  });

  test("bento e-cells render structured content", () => {
    const r = ex(
      `<e-bento cols="2">
        <e-cell eyebrow="Fast" chip="No transfer"><h3>H</h3><p>B</p></e-cell>
      </e-bento>`,
    );
    expect(r.body).toContain(`bento bento--cols-2">`);
    expect(r.body).toContain(`bento__cell">`);
    expect(r.body).toContain(`eyebrow"><i></i> Fast`);
    expect(r.body).toContain(`chip">No transfer`);
    expect(r.body).toContain("<h3>H</h3>");
    expect(r.body).not.toContain("slot=");
  });

  test("e-example and e-note render fine print", () => {
    const r = ex(
      `<e-example file="a.jpg" before="3.4 MB" after="2.5 MB" save="−27%"></e-example><e-note center>Note.</e-note>`,
    );
    expect(r.body).toContain(`example-row"><span><b>a.jpg</b> 3.4 MB → 2.5 MB</span><span class="save">−27%</span></div>`);
    expect(r.body).toContain(`note note--center">Note.</p>`);
  });

  test("steps footnote attribute renders centered note", () => {
    const r = ex(
      `<e-steps footnote="Select → Compress → Done."><e-step title="A">x</e-step></e-steps>`,
    );
    expect(r.body).toContain(`small muted steps__footnote">Select → Compress → Done.`);
  });
});

describe("releases (downloads)", () => {
  const data = {
    releases: [
      {
        version: "1.4.0",
        date: "2 December 2024",
        kind: "stable",
        latest: true,
        tags: ["added", "improved"],
        notes: { added: ["Thing <b>one</b>"], improved: ["Two"] },
        assets: [
          { name: "Setup-1.4.0.exe", type: "installer", sizeLabel: "18.2 MB", shaShort: "9f4e…71ac", url: "https://assets.compressy.app/1-4-0/S.exe" },
          { name: "Portable-1.4.0.zip", type: "portable", sizeLabel: "16.8 MB", shaShort: "c77b…03de", url: "https://assets.compressy.app/1-4-0/P.zip" },
        ],
      },
      { version: "1.3.2", date: "14 November 2024", kind: "patch", tags: ["fixed"], notes: { fixed: ["Bugfix"] }, assets: [{ name: "Setup-1.3.2.exe", type: "installer", sizeLabel: "18.0 MB", shaShort: "a1c8…4e90", url: "https://assets.compressy.app/1-3-2/S.exe" }] },
    ],
  };
  const ctxData = { ...ctx, data };

  test("first release featured, rest compact", () => {
    const r = expandPage(`<body><e-releases></e-releases></body>`, ctxData, registry);
    expect(r.body).toContain(`release release--featured" id="v140"`);
    expect(r.body).toContain(`release release--compact" id="v132"`);
    expect(r.body).toContain(`release__head--warm`);
    expect(r.body).toContain(`class="pill">Latest</span>`);
  });

  test("notes grouped by kind with trusted html", () => {
    const r = expandPage(`<body><e-releases></e-releases></body>`, ctxData, registry);
    expect(r.body).toContain(`note-group__label added"><i></i> Added`);
    expect(r.body).toContain(`note-list"><li>Thing <b>one</b></li>`);
  });

  test("assets carry R2 urls, sha and per-position button style", () => {
    const r = expandPage(`<body><e-releases></e-releases></body>`, ctxData, registry);
    expect(r.body).toContain(`href="https://assets.compressy.app/1-4-0/S.exe" download`);
    expect(r.body).toContain(`btn btn-primary btn-xs`);
    expect(r.body).toContain(`data-copy-sha="9f4e…71ac"`);
  });

  test("foot compares to previous release", () => {
    const r = expandPage(`<body><e-releases></e-releases></body>`, ctxData, registry);
    expect(r.body).toContain("Compare to v1.3.2");
  });

  test("e-release-hero derives latest labels + jump pills from data", () => {
    const r = expandPage(
      `<body><e-release-hero eyebrow="R" title="D&amp;C"></e-release-hero></body>`,
      ctxData,
      registry,
    );
    expect(r.body).toContain("Download v1.4.0 for Windows");
    expect(r.body).toContain(`dl-hero__count">2 releases`);
    expect(r.body).toContain(`href="#v132">v1.3.2</a>`);
  });

  test("filter element renders search + chips", () => {
    const r = ex(`<e-release-filter></e-release-filter>`);
    expect(r.body).toContain(`release-search`);
    expect(r.body).toContain(`data-chip="improved"`);
  });
});

describe("splits", () => {
  test("narrow keeps semantic list wrapper in list slot", () => {
    const r = ex(
      `<e-split variant="narrow">
        <ul slot="list"><li><strong>No account.</strong> <span>— just open.</span></li></ul>
        <div slot="card"><h3>Ready.</h3><p>Install once.</p></div>
      </e-split>`,
    );
    expect(r.body).toContain(`split split--narrow`);
    expect(r.body).toContain(`split__list"><ul><li>`);
    expect(r.body).toContain(`<strong>No account.</strong>`);
    expect(r.body).toContain(`split__card"><h3>Ready.</h3>`);
  });
});

describe("content", () => {
  test("prose excludes slotted lead", () => {
    const r = ex(
      `<e-content eyebrow="Guide" title="Deep dive">
        <p slot="lead">Intro line.</p>
        <h3>Section</h3>
        <p>Body text.</p>
      </e-content>`,
    );
    expect(r.body).toContain(`eyebrow"><i></i> Guide`);
    expect(r.body).toContain(`lead" style="margin-top:14px">Intro line.`);
    expect(r.body).toContain("content__prose");
    const proseIdx = r.body.indexOf("content__prose");
    expect(r.body.slice(proseIdx)).toContain("<h3>Section</h3>");
    expect(r.body.slice(proseIdx)).not.toContain("Intro line.");
  });
  test("e-content docs variant renders content--docs with toc", () => {
    const r = ex(`<e-content variant="docs" eyebrow="Docs"><h2>Quick start</h2><p>Body.</p></e-content>`);
    expect(r.body).toContain("content--docs");
    expect(r.body).toContain("content-grid");
  });
});

describe("design-vs-element audit fixes (REGISTRY_VERSION 8)", () => {
  test("e-faq list variant renders mono numeral column", () => {
    const r = ex(
      `<e-faq variant="list">
        <details><summary>Q one?</summary><p>A one.</p></details>
        <details><summary>Q two?</summary><p>A two.</p></details>
      </e-faq>`,
    );
    expect(r.body).toContain(`faq__num">01`);
    expect(r.body).toContain(`faq__num">02`);
  });
  test("e-faq compact variant uses the design eyebrow style", () => {
    const r = ex(
      `<e-faq variant="compact">
        <details><summary>No cloud?</summary><p>No uploads.</p></details>
      </e-faq>`,
    );
    expect(r.body).toContain(`faq--compact`);
    // no num column for compact
    expect(r.body).not.toContain(`faq__num`);
  });
  test("e-cta split renders meta inside .cta__panel", () => {
    const r = ex(
      `<e-cta variant="split" meta="18.2 MB · portable .zip">
        <h2>T</h2>
        <span slot="actions"><e-button>Go</e-button></span>
      </e-cta>`,
    );
    expect(r.body).toContain(`cta__panel`);
    const panelIdx = r.body.indexOf("cta__panel");
    expect(r.body.slice(panelIdx)).toContain(`cta__meta">18.2 MB`);
  });
  test("e-table reads tfoot and renders dtable__foot row", () => {
    const r = ex(
      `<e-table variant="savings">
        <table>
          <thead><tr><th>File</th><th>Before</th><th>After</th><th>Saved</th></tr></thead>
          <tbody><tr><td>a.jpg</td><td>3.4 MB</td><td>2.5 MB</td><td>−27%</td></tr></tbody>
          <tfoot><tr><td>Total</td><td>11.5 MB</td><td>8.0 MB</td><td>−30% avg</td></tr></tfoot>
        </table>
      </e-table>`,
    );
    expect(r.body).toContain(`dtable__foot`);
    expect(r.body).toContain(`dtable--with-foot`);
    expect(r.body).toContain(`−30% avg`);
  });
  test("e-stats strip variant no longer emits unstyled statstrip__item class", () => {
    const r = ex(
      `<e-stats variant="strip">
        <e-stat value="18.4 MB" label="folder"></e-stat>
        <e-stat value="−4.2 MB" label="saved"></e-stat>
      </e-stats>`,
    );
    expect(r.body).not.toContain("statstrip__item");
    expect(r.body).toContain(`statstrip`);
  });
  test("e-grid-proof strip variant drops statstrip__item", () => {
    const r = ex(
      `<e-grid-proof variant="strip">
        <e-stat value="18.4 MB" label="folder"></e-stat>
      </e-grid-proof>`,
    );
    expect(r.body).not.toContain("statstrip__item");
  });
  test("e-grid-bento cols=4 emits bento--cols-4 (CSS-supported)", () => {
    const r = ex(
      `<e-grid-bento cols="4">
        <e-cell><h3>A</h3></e-cell><e-cell><h3>B</h3></e-cell>
        <e-cell><h3>C</h3></e-cell><e-cell><h3>D</h3></e-cell>
      </e-grid-bento>`,
    );
    expect(r.body).toContain(`bento--cols-4`);
  });
  test("e-steps icons variant renders icon when svg child is present, no num", () => {
    const r = ex(
      `<e-steps variant="icons">
        <e-step title="Source">
          <svg viewBox="0 0 16 16"><path d="M1 1h14v14H1z"/></svg>
          Pick a folder.
        </e-step>
      </e-steps>`,
    );
    expect(r.body).toContain(`step__icon`);
    expect(r.body).toContain(`<svg viewBox="0 0 16 16"`);
    // body must not contain the svg a second time
    expect((r.body.match(/<svg viewBox="0 0 16 16"/g) ?? []).length).toBe(1);
  });
  test("e-points cols variant preserves nested list innerHTML", () => {
    const r = ex(
      `<e-points variant="cols">
        <li><strong>Offline</strong><ul><li>No uploads</li><li>No cloud</li></ul></li>
      </e-points>`,
    );
    expect(r.body).toContain(`<ul><li>No uploads</li><li>No cloud</li></ul>`);
  });
  test("e-logos caption renders as eyebrow above the row", () => {
    const r = ex(
      `<e-logos variant="bar" caption="Built for Windows">A B C</e-logos>`,
    );
    const eyebrowIdx = r.body.indexOf(`logos-eyebrow`);
    const rowIdx = r.body.indexOf(`logos--bar`);
    expect(eyebrowIdx).toBeGreaterThan(-1);
    expect(rowIdx).toBeGreaterThan(eyebrowIdx);
  });
  test("e-content drops unstyled content/content--editorial wrapper", () => {
    const r = ex(`<e-content eyebrow="G" title="T"><p>Body.</p></e-content>`);
    expect(r.body).not.toContain(`content content--editorial`);
    expect(r.body).toContain("content__prose");
  });
  test("e-releases non-featured assets omit the icon span", () => {
    const data = {
      releases: [
        {
          version: "1.3.2",
          date: "14 November 2024",
          kind: "patch",
          tags: ["fixed"],
          notes: { fixed: ["Bugfix"] },
          assets: [
            { name: "Setup-1.3.2.exe", type: "installer", sizeLabel: "18.0 MB", shaShort: "a1c8…4e90", url: "https://x/S.exe" },
          ],
        },
      ],
    };
    const r = expandPage(`<body><e-releases></e-releases></body>`, { ...ctx, data }, registry);
    // the only release is non-featured; the asset icon span must not be emitted
    expect(r.body).not.toContain("asset__icon--empty");
  });
});

describe("comparison cards (design/examples.html)", () => {
  test("e-comparison renders before/after cells with det rows, save, button", () => {
    const r = ex(
      `<e-comparison before-label="Original" after-label="Compressed">
        <e-compare-item>
          <e-compare-cell title="Uncompressed JPG" mono="hero.jpg">
            <img slot="media" src="/x.jpg" alt="orig">
            <e-compare-det label="File size">4.82 MB <span>· no compression</span></e-compare-det>
            <e-compare-det label="Dimensions">3840 × 2160 px</e-compare-det>
            <e-button variant="ghost" href="/x">Download original</e-button>
          </e-compare-cell>
          <e-compare-cell title="85 quality JPG" mono="hero-85.jpg">
            <img slot="media" src="/y.webp" alt="comp">
            <e-compare-det label="File size">1.42 MB <span>· as saved</span></e-compare-det>
            <e-compare-result save="−70% · 3.40 MB saved"></e-compare-result>
            <e-button variant="primary" href="/y">Download 85q</e-button>
          </e-compare-cell>
        </e-compare-item>
      </e-comparison>`,
    );
    expect(r.body).not.toContain("<e-");
    expect(r.body).toContain(`compare__col">Original<span class="compare__col-tag">Before`);
    expect(r.body).toContain(`compare__col compare__col--after">Compressed<span class="compare__col-tag">After`);
    expect(r.body).toContain(`compare__cell`);
    expect(r.body).toContain(`compare__cell--after`);
    expect(r.body).toContain("<h2>Uncompressed JPG</h2>");
    expect(r.body).toContain(`compare__mono">hero.jpg`);
    expect(r.body).toContain(`compare__lbl">File size`);
    expect(r.body).toContain(`compare__dim"> · no compression`);
    expect(r.body).toContain(`compare__save">−70% · 3.40 MB saved`);
    expect(r.body).toContain(`btn btn-ghost`);
    expect(r.body).toContain(`btn btn-primary`);
  });
});


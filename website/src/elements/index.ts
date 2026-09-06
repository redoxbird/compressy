import type { DomNode, ElementDef } from "./registry";
import { site } from "../config";
import baseLayout from "../layouts/base.html";

import ePill from "./e-pill.html";
import eButton from "./e-button.html";
import eCard from "./e-card.html";
import eHero from "./e-hero.html";
import eMock from "./e-mock.html";
import eCards from "./e-cards.html";
import eGridFeature from "./e-grid-feature.html";
import eGridProof from "./e-grid-proof.html";
import eGridBento from "./e-grid-bento.html";
import eGridDense from "./e-grid-dense.html";
import eBento from "./e-bento.html";
import eStats from "./e-stats.html";
import eSteps from "./e-steps.html";
import ePoints from "./e-points.html";
import eLogos from "./e-logos.html";
import eFaq from "./e-faq.html";
import eTable from "./e-table.html";
import eCta from "./e-cta.html";
import eContent from "./e-content.html";
import eSplit from "./e-split.html";
// ── per-variant partials (Phase 1 — 45 files) ──
import eCtaBand from "./e-cta--band.html";
import eCtaSplit from "./e-cta--split.html";
import eCtaInline from "./e-cta--inline.html";
import eCtaCards from "./e-cta--cards.html";
import eCardsIcons from "./e-cards--icons.html";
import eCardsRules from "./e-cards--rules.html";
import eCardsRows from "./e-cards--rows.html";
import eGridFeatureIcons from "./e-grid-feature--icons.html";
import eGridFeatureRules from "./e-grid-feature--rules.html";
import eGridFeatureRows from "./e-grid-feature--rows.html";
import eGridDenseIcons from "./e-grid-dense--icons.html";
import eGridDenseRules from "./e-grid-dense--rules.html";
import eGridDenseRows from "./e-grid-dense--rows.html";
import eGridProofStrip from "./e-grid-proof--strip.html";
import eGridProofRules from "./e-grid-proof--rules.html";
import eGridProofRow from "./e-grid-proof--row.html";
import eGridProofBento from "./e-grid-proof--bento.html";
import eStatsStrip from "./e-stats--strip.html";
import eStatsRules from "./e-stats--rules.html";
import eStatsRow from "./e-stats--row.html";
import eStatsBento from "./e-stats--bento.html";
import eStepsHorizontal from "./e-steps--horizontal.html";
import eStepsTimeline from "./e-steps--timeline.html";
import eStepsNumbered from "./e-steps--numbered.html";
import eStepsIcons from "./e-steps--icons.html";
import ePointsChecks from "./e-points--checks.html";
import ePointsCols from "./e-points--cols.html";
import ePointsNumbered from "./e-points--numbered.html";
import ePointsDots from "./e-points--dots.html";
import eLogosBar from "./e-logos--bar.html";
import eLogosGrid from "./e-logos--grid.html";
import eLogosPills from "./e-logos--pills.html";
import eLogosCluster from "./e-logos--cluster.html";
import eFaqAccordion from "./e-faq--accordion.html";
import eFaqCards from "./e-faq--cards.html";
import eFaqList from "./e-faq--list.html";
import eFaqCompact from "./e-faq--compact.html";
import eTableSavings from "./e-table--savings.html";
import eTableMatrix from "./e-table--matrix.html";
import eTableChangelog from "./e-table--changelog.html";
import eTablePricing from "./e-table--pricing.html";
import eButtonPrimary from "./e-button--primary.html";
import eButtonGhost from "./e-button--ghost.html";
import eSplitNarrow from "./e-split--narrow.html";
import eSplitCard from "./e-split--card.html";
import eContentEditorial from "./e-content--editorial.html";
import eContentDocs from "./e-content--docs.html";
import eContentExplainer from "./e-content--explainer.html";
import eContentKb from "./e-content--kb.html";
import eSplitEditor from "./e-split--editor.html";
import eSplitAlternating from "./e-split--alternating.html";
import eSplitContentCard from "./e-split--content-card.html";
import eMockDefault from "./e-mock--default.html";
import eMockApp from "./e-mock--app.html";
import eSection from "./e-section.html";
import eProgressLine from "./e-progress-line.html";
import eExample from "./e-example.html";
import eNote from "./e-note.html";
import eDemoHead from "./e-demo-head.html";
import eGap from "./e-gap.html";
import eBentoCell from "./e-bento-cell.html";
import eComparison from "./e-comparison.html";
import eComparisonItem from "./e-comparison-item.html";
import eComparisonCell from "./e-comparison-cell.html";
import eReleases from "./e-releases.html";
import eReleaseHero from "./e-release-hero.html";
import eReleaseFilter from "./e-release-filter.html";

export const LAYOUT_SOURCE = baseLayout;

export const PARTIALS: Record<string, string> = {
  "e-pill": ePill,
  "e-button": eButton,
  "e-card": eCard,
  "e-hero": eHero,
  "e-mock": eMock,
  "e-cards": eCards,
  "e-bento": eBento,
  "e-bento-cell": eBentoCell,
  "e-comparison": eComparison,
  "e-comparison-item": eComparisonItem,
  "e-comparison-cell": eComparisonCell,
  "e-stats": eStats,
  "e-grid-feature": eGridFeature,
  "e-grid-proof": eGridProof,
  "e-grid-bento": eGridBento,
  "e-grid-dense": eGridDense,
  "e-steps": eSteps,
  "e-points": ePoints,
  "e-logos": eLogos,
  "e-faq": eFaq,
  "e-table": eTable,
  "e-cta": eCta,
  "e-content": eContent,
  "e-split": eSplit,
  "e-section": eSection,
  "e-progress-line": eProgressLine,
  "e-example": eExample,
  "e-note": eNote,
  "e-demo-head": eDemoHead,
  "e-gap": eGap,
  "e-releases": eReleases,
  "e-release-hero": eReleaseHero,
  "e-release-filter": eReleaseFilter,
  // ── per-variant partials (Phase 1) ──
  "e-cta--band": eCtaBand,
  "e-cta--split": eCtaSplit,
  "e-cta--inline": eCtaInline,
  "e-cta--cards": eCtaCards,
  "e-cards--icons": eCardsIcons,
  "e-cards--rules": eCardsRules,
  "e-cards--rows": eCardsRows,
  "e-grid-feature--icons": eGridFeatureIcons,
  "e-grid-feature--rules": eGridFeatureRules,
  "e-grid-feature--rows": eGridFeatureRows,
  "e-grid-dense--icons": eGridDenseIcons,
  "e-grid-dense--rules": eGridDenseRules,
  "e-grid-dense--rows": eGridDenseRows,
  "e-grid-proof--strip": eGridProofStrip,
  "e-grid-proof--rules": eGridProofRules,
  "e-grid-proof--row": eGridProofRow,
  "e-grid-proof--bento": eGridProofBento,
  "e-stats--strip": eStatsStrip,
  "e-stats--rules": eStatsRules,
  "e-stats--row": eStatsRow,
  "e-stats--bento": eStatsBento,
  "e-steps--horizontal": eStepsHorizontal,
  "e-steps--timeline": eStepsTimeline,
  "e-steps--numbered": eStepsNumbered,
  "e-steps--icons": eStepsIcons,
  "e-points--checks": ePointsChecks,
  "e-points--cols": ePointsCols,
  "e-points--numbered": ePointsNumbered,
  "e-points--dots": ePointsDots,
  "e-logos--bar": eLogosBar,
  "e-logos--grid": eLogosGrid,
  "e-logos--pills": eLogosPills,
  "e-logos--cluster": eLogosCluster,
  "e-faq--accordion": eFaqAccordion,
  "e-faq--cards": eFaqCards,
  "e-faq--list": eFaqList,
  "e-faq--compact": eFaqCompact,
  "e-table--savings": eTableSavings,
  "e-table--matrix": eTableMatrix,
  "e-table--changelog": eTableChangelog,
  "e-table--pricing": eTablePricing,
  "e-button--primary": eButtonPrimary,
  "e-button--ghost": eButtonGhost,
  "e-split--narrow": eSplitNarrow,
  "e-split--card": eSplitCard,
  "e-content--editorial": eContentEditorial,
  "e-content--docs": eContentDocs,
  "e-content--explainer": eContentExplainer,
  "e-content--kb": eContentKb,
  "e-split--editor": eSplitEditor,
  "e-split--alternating": eSplitAlternating,
  "e-split--content-card": eSplitContentCard,
  "e-mock--default": eMockDefault,
  "e-mock--app": eMockApp
};

// ── shared DOM helpers (structural, linkedom-compatible) ──────────

function kids(node: DomNode): DomNode[] {
  return Array.from(node.childNodes).filter((n) => n.nodeType === 1);
}

function byTag(node: DomNode, tag: string): DomNode[] {
  const t = tag.toLowerCase();
  return kids(node).filter((el) => el.tagName.toLowerCase() === t);
}

/** Raw attribute read — null when absent (so presence checks like === "" work). */
function attr(el: DomNode, name: string): string | null {
  return el.getAttribute(name);
}

/** Direct children of a parent that are NOT slot-marked. */
function unslotted(node: DomNode): DomNode[] {
  return kids(node).filter((el) => el.getAttribute("slot") === null);
}

const EXT_CLS: Record<string, string> = { jpg: "jpg", png: "png", webp: "webp", avif: "avif" };

// ── releases (downloads page) ─────────────────────────────────────

interface ReleaseAsset {
  name?: string;
  type?: string;
  sizeLabel?: string;
  shaShort?: string;
  url?: string;
}
interface Release {
  version?: string;
  versionTag?: string;
  date?: string;
  kind?: string;
  latest?: boolean;
  tags?: string[];
  notes?: Record<string, string[]>;
  assets?: ReleaseAsset[];
}

const ICON_INSTALLER =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="2.5" width="10" height="11" rx="1.6" stroke="currentColor" stroke-width="1.3"/><path d="M6 6h4M6 8.2h4M6 10.4h2.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
const ICON_PORTABLE =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 4.5A1.5 1.5 0 0 1 5 3h3.2l1.3 1.3H11A1.5 1.5 0 0 1 12.5 6v5.5A1.5 1.5 0 0 1 11 13H5A1.5 1.5 0 0 1 3.5 11.5V4.5Z" stroke="currentColor" stroke-width="1.25"/><path d="M5 6h5.5M5 8.5h5.5M5 11h3.5" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/></svg>';

const NOTE_KINDS: Array<{ key: string; label: string }> = [
  { key: "added", label: "Added" },
  { key: "improved", label: "Improved" },
  { key: "fixed", label: "Fixed" },
];

const KIND_PILL: Record<string, { cls: string; text: string }> = {
  patch: { cls: "pill--neutral", text: "Patch" },
  minor: { cls: "pill--warm", text: "Minor" },
  initial: { cls: "pill--neutral", text: "Initial" },
};

function releaseItems(data: unknown) {
  const list = Array.isArray((data as { releases?: unknown[] })?.releases)
    ? ((data as { releases: Release[] }).releases)
    : [];
  return list.map((r, idx) => {
    const versionTag = r.versionTag ?? (r.version ? `v${r.version}` : "v0.0.0");
    const id = "v" + versionTag.replace(/^v/i, "").replace(/[^a-zA-Z0-9]/g, "");
    const featured = idx === 0 && r.latest !== false;
    const assets = Array.isArray(r.assets) ? r.assets : [];
    const badges = featured
      ? '<span class="pill">Latest</span><span class="pill pill--warm">Stable</span>'
      : (() => {
          const pill = KIND_PILL[r.kind ?? ""] ?? { cls: "pill--neutral", text: "Release" };
          return `<span class="pill ${pill.cls}">${pill.text}</span>`;
        })();
    const metaLine = featured
      ? `${r.date ?? ""} · Windows 10 / 11 · 64-bit · Signed installer`
      : `${r.date ?? ""}`;
    const sizeSummary =
      assets
        .map((a) => (a.sizeLabel ? `${a.sizeLabel} ${a.type === "portable" ? "portable" : "installer"}` : ""))
        .filter(Boolean)
        .join(" · ") || `${assets.length} file(s)`;
    const noteGroups = NOTE_KINDS.map(({ key, label }) => {
      const notes = r.notes?.[key];
      if (!Array.isArray(notes) || notes.length === 0) return null;
      return { kind: key, label, notes };
    }).filter(Boolean) as Array<{ kind: string; label: string; notes: string[] }>;
    const mappedAssets = assets.map((a, ai) => ({
      icon: a.type === "portable" ? ICON_PORTABLE : ICON_INSTALLER,
      showIcon: featured,
      name: a.name ?? "Download",
      sizeLabel: a.sizeLabel ?? "",
      typeLabel: a.type === "portable" ? "Portable · No install" : "Installer",
      shaShort: a.shaShort ?? "",
      url: a.url ?? "#",
      btnCls: featured && ai === 0 ? "btn-primary" : "btn-ghost",
      showSha: featured || ai === 0,
    }));
    const next = list[idx + 1];
    const compareLabel = next
      ? `Compare to ${next.versionTag ?? (next.version ? `v${next.version}` : "?")}`
      : "";
    return {
      id,
      versionTag,
      featured,
      badges,
      metaLine,
      sizeSummary,
      tags: (r.tags ?? []).join(" "),
      showChangelogHeading: featured,
      noteGroups,
      assets: mappedAssets,
      compareLabel,
      footSha: mappedAssets[0]?.shaShort ?? "",
      footRequires: featured ? "Requires Windows 10 1809+ · WebView2 not required" : "",
    };
  });
}

/** "2 December 2024 · Windows 10 / 11 · 64-bit · Signed installer" → "2 December 2024" */
function stripVersionSuffix(metaLine: string): string {
  return metaLine.split("·")[0].trim();
}

// ── element definitions ───────────────────────────────────────────


// ── comparison cells (design/examples.html) ──

interface CompareCellData {
  title: string;
  mono: string;
  media: string;
  rows: Array<{ label: string; value: string; dim: string }>;
  save: string;
  actions: string;
  after: boolean;
}

function compareCellData(el: DomNode, after: boolean): CompareCellData {
  const titleAttr = attr(el, "title") ?? "";
  const h2 = el.querySelectorAll("h2")[0];
  const title = h2 ? h2.innerHTML : titleAttr;
  const mono = attr(el, "mono") ?? "";
  // media: first direct svg or img child (not slot-marked), strip slot attr
  let media = "";
  const mediaChild = kids(el).find((n) => ["svg", "img"].includes(n.tagName.toLowerCase()));
  if (mediaChild) {
    const cloned = mediaChild.cloneNode?.(true) ?? mediaChild;
    cloned.removeAttribute?.("slot");
    media = (cloned.outerHTML) || mediaChild.outerHTML;
  }
  const rows = byTag(el, "e-compare-det").map((d) => {
    const label = attr(d, "label") ?? "";
    const span = byTag(d, "span")[0];
    let value = (d.textContent ?? "").trim();
    let dim = "";
    if (span) {
      dim = (span.textContent ?? "").trim();
      value = (d.textContent ?? "").replace(span.textContent ?? "", "").trim();
    }
    return { label, value, dim: dim ? " " + dim : "" };
  });
  const resultEl = byTag(el, "e-compare-result")[0];
  const save = resultEl ? (attr(resultEl, "save") ?? "") : (attr(el, "save") ?? "");
  // actions: remaining unslotted children, excluding data-only det/result consumed above
  const actions = unslotted(el)
    .filter((n) => !["e-compare-det", "e-compare-result"].includes(n.tagName.toLowerCase()))
    .map((n) => n.outerHTML)
    .join("");
  return { title, mono, media, rows, save, actions, after };
}

export const PROD_DEFS: ElementDef[] = [
  // ── atoms ──
  {
    templateName: "e-pill",
    mapper: (api) => ({ tone: api.attrs().tone ?? "default", text: api.text() }),
  },
  {
    templateName: "e-button",
    mapper: (api) => {
      const a = api.attrs();
      const variant = a.variant === "ghost" ? "ghost" : "primary";
      const size = a.size === "sm" ? "sm" : "";
      const cls = ["btn", `btn-${variant}`, size ? "btn-sm" : ""].filter(Boolean).join(" ");
      return { cls, variant, primary: variant === "primary" ? "1" : "", ghost: variant === "ghost" ? "1" : "", size, href: a.href ?? "/", text: api.node.innerHTML };
    },
  },
  {
    templateName: "e-card",
    mapper: (api) => {
      const a = api.attrs();
      // type="format": badge-card variant (badge + hint + body), no icon area
      if (a.type === "format") {
        const badge = (a.badge || a.ext || "").toUpperCase();
        return {
          isFormat: "1",
          badge,
          badgeCls: badge.toLowerCase() === "jpg" ? "" : badge.toLowerCase(),
          hint: a.hint ?? "",
          title: "",
          body: api.slot("body") ?? api.child("p") ?? api.text(),
        };
      }
      return {
        isFormat: "",
        icon: api.outer("svg"),
        title: api.child("h3") ?? "",
        body: api.slot("body") ?? api.child("p") ?? "",
      };
    },
  },

  // ── hero ──
  {
    templateName: "e-hero",
    mapper: (api) => {
      const proofItems = byTag(api.node, "e-proof").map((el) => {
        const value = attr(el, "value") ?? "";
        return {
          value,
          label: attr(el, "label") ?? "",
          toneCls: (attr(el, "success") ?? null) !== null ? "success" : "strong",
        };
      });
      return {
        pill: api.attrs().pill ?? "",
        title: api.child("h1") ?? api.attrs().title ?? "",
        lead: api.slot("lead") ?? "",
        actions: api.slot("actions") ?? "",
        meta: api.slot("meta") ?? "",
        proof: api.slot("proof") ?? "",
        proofItems,
      };
    },
  },

  // ── app mock (bespoke) ──
  {
    templateName: "e-mock",
    mapper: (api) => {
      const a = api.attrs();
      const variant = a.variant === "app" ? "app" : "default";
      const src = byTag(api.node, "mock-src").map((el) => {
        const ext = (attr(el, "ext") || "jpg").toLowerCase();
        return {
          checked: attr(el, "check") !== "false",
          name: attr(el, "name"),
          ext: ext.toUpperCase(),
          extCls: EXT_CLS[ext] ?? "jpg",
          size: attr(el, "size"),
        };
      });
      const out = byTag(api.node, "mock-out").map((el) => {
        const ext = (attr(el, "ext") || "jpg").toLowerCase();
        return {
          name: attr(el, "name"),
          ext: ext.toUpperCase(),
          extCls: EXT_CLS[ext] ?? "jpg",
          dims: attr(el, "dims"),
          save: attr(el, "save"),
        };
      });
      return {
        title: a.title || `${api.ctx.site.brand.name} — Image Optimizer`,
        path: a.path || "",
        count: a.count || String(src.length),
        savedLabel: a.saved || "0 KB saved",
        srcCount: a.selected || String(Math.min(4, src.length)),
        noteLeft: a.noteLeft || "Quality 85 · Balanced · Keep format",
        noteRight: a.noteRight || "4 threads",
        outNoteLeft: a.outNoteLeft || "Avg. −26% · Peak −31%",
        outNoteRight: a.outNoteRight || "Export CSV · Open folder",
        caption: a.caption || "",
        variant,
        app: variant === "app" ? "1" : "",
        default: variant === "default" ? "1" : "",
        src,
        out,
      };
    },
  },

  // ── grids ──
  {
    templateName: "e-cards",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["icons", "rules", "rows"].includes(a.variant) ? a.variant : "";
      const cols = parseInt(a.cols || "", 10);
      const colsClass = cols >= 2 && cols <= 4 ? `cols-${cols}` : "";
      return {
        cardsCls: ["cards", variant ? `cards--${variant}` : "", colsClass].filter(Boolean).join(" "),
        colsClass,
        variant,
        icons: variant === "icons" ? "1" : "",
        rules: variant === "rules" ? "1" : "",
        rows: variant === "rows" ? "1" : "",
        inner: api.node.innerHTML,
      };
    },
  },
  {
    templateName: "e-bento",
    mapper: (api) => {
      const cols = parseInt(api.attrs().cols || "", 10);
      const items = unslotted(api.node).map((el) => {
        const tag = el.tagName.toLowerCase();
        const span = attr(el, "span");
        const wide = span === "2" || span === "w2";
        const tall = span === "tall" || span === "r2";
        const dark = (attr(el, "dark") ?? null) !== null;
        // structured cells keep pages fully classless
        if (tag === "e-cell") {
          return {
            cls: [
              "bento__cell",
              wide ? "bento__cell--wide" : "",
              tall ? "bento__cell--tall" : "",
              dark ? "bento__cell--dark" : "",
            ]
              .filter(Boolean)
              .join(" "),
            html: api.render("e-bento-cell", {
              eyebrow: attr(el, "eyebrow") ?? "",
              chip: attr(el, "chip") ?? "",
              body: el.innerHTML.trim(),
            }),
          };
        }
        // passthrough: bare articles with presentation attrs
        return {
          cls: ["bento__cell", wide ? "bento__cell--wide" : "", tall ? "bento__cell--tall" : "", dark ? "bento__cell--dark" : ""]
            .filter(Boolean)
            .join(" "),
          html: el.outerHTML,
        };
      });
      return { items, colsClass: cols === 2 || cols === 4 ? `bento--cols-${cols}` : "" };
    },
  },
  // ── grids — discrete aliases for design/grids.html (compliant mapping) ──
  // Each reuses the shared mapper/template so there is no duplication of styling/logic.
  {
    templateName: "e-grid-feature",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["icons", "rules", "rows"].includes(a.variant) ? a.variant : "";
      const cols = parseInt(a.cols || "3", 10);
      const colsClass = cols >= 2 && cols <= 4 ? `cols-${cols}` : "cols-3";
      return {
        cardsCls: ["cards", variant ? `cards--${variant}` : "", colsClass].filter(Boolean).join(" "),
        colsClass,
        variant,
        icons: variant === "icons" ? "1" : "",
        rules: variant === "rules" ? "1" : "",
        rows: variant === "rows" ? "1" : "",
        inner: api.node.innerHTML,
      };
    },
  },
  {
    templateName: "e-grid-proof",
    mapper: (api) => {
      const a = api.attrs();
      const rawVariant = a.variant || "row";
      const strip = rawVariant === "strip";
      const rules = rawVariant === "rules" || strip;
      const row = rawVariant === "row";
      const bento = rawVariant === "bento";
      const items = byTag(api.node, "e-stat").map((el) => {
        const value = attr(el, "value");
        return {
          value,
          label: attr(el, "label"),
          note: attr(el, "note"),
          bar: attr(el, "bar") !== "",
          barPct: parseInt(attr(el, "bar") || "0", 10),
          valueCls: /[−-]\d/.test(value ?? "") ? "success" : "strong",
        };
      });
      return { strip: strip ? "1" : "", rules: rules && !strip ? "1" : "", row: row ? "1" : "", bento: bento ? "1" : "", variant: strip ? "rules" : rawVariant, items };
    },
  },
  {
    templateName: "e-grid-bento",
    mapper: (api) => {
      const cols = parseInt(api.attrs().cols || "2", 10);
      const items = unslotted(api.node).map((el) => {
        const tag = el.tagName.toLowerCase();
        const span = attr(el, "span");
        const wide = span === "2" || span === "w2";
        const tall = span === "tall" || span === "r2";
        const dark = (attr(el, "dark") ?? null) !== null;
        if (tag === "e-cell") {
          return {
            cls: ["bento__cell", wide ? "bento__cell--wide" : "", tall ? "bento__cell--tall" : "", dark ? "bento__cell--dark" : ""].filter(Boolean).join(" "),
            html: api.render("e-bento-cell", { eyebrow: attr(el, "eyebrow") ?? "", chip: attr(el, "chip") ?? "", body: el.innerHTML.trim() }),
          };
        }
        return { cls: ["bento__cell", wide ? "bento__cell--wide" : "", tall ? "bento__cell--tall" : "", dark ? "bento__cell--dark" : ""].filter(Boolean).join(" "), html: el.outerHTML };
      });
      return { items, colsClass: cols === 2 || cols === 4 ? `bento--cols-${cols}` : "bento--cols-2" };
    },
  },
  {
    templateName: "e-grid-dense",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["icons", "rules", "rows"].includes(a.variant) ? a.variant : "";
      const cols = parseInt(a.cols || "3", 10);
      const colsClass = cols >= 2 && cols <= 4 ? `cols-${cols}` : "cols-3";
      return { cardsCls: ["cards", variant ? `cards--${variant}` : "", colsClass].filter(Boolean).join(" "), colsClass, variant, icons: variant === "icons" ? "1" : "", rules: variant === "rules" ? "1" : "", rows: variant === "rows" ? "1" : "", inner: api.node.innerHTML };
    },
  },

  // ── stats ──
  {
    templateName: "e-stats",
    mapper: (api) => {
      const a = api.attrs();
      const rawVariant = a.variant || "rules";
      const strip = rawVariant === "strip";
      const rules = rawVariant === "rules" || strip;
      const row = rawVariant === "row";
      const bento = rawVariant === "bento";
      const items = byTag(api.node, "e-stat").map((el) => {
        const value = attr(el, "value");
        return {
          value,
          label: attr(el, "label"),
          note: attr(el, "note"),
          bar: attr(el, "bar") !== "",
          barPct: parseInt(attr(el, "bar") || "0", 10),
          valueCls: /[−-]\d/.test(value ?? "") ? "success" : "strong",
        };
      });
      return { strip: strip ? "1" : "", rules: rules && !strip ? "1" : "", row: row ? "1" : "", bento: bento ? "1" : "", variant: strip ? "rules" : rawVariant, items };
    },
  },

  // ── steps ──
  {
    templateName: "e-steps",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["horizontal", "timeline", "numbered", "icons"].includes(a.variant)
        ? a.variant
        : "horizontal";
      const items = byTag(api.node, "e-step").map((el, i) => {
        const iconEl = byTag(el, "svg")[0];
        // pull the icon out of the body so it doesn't render twice
        if (iconEl?.remove) iconEl.remove();
        return {
          num: String(i + 1).padStart(2, "0"),
          label: attr(el, "label") || (variant === "timeline" ? `Step ${String(i + 1).padStart(2, "0")}` : ""),
          title: attr(el, "title"),
          body: el.innerHTML.trim(),
          meta: attr(el, "meta"),
          icon: iconEl ? iconEl.outerHTML : "",
        };
      });
      return { variant, horizontal: variant === "horizontal" ? "1" : "", timeline: variant === "timeline" ? "1" : "", numbered: variant === "numbered" ? "1" : "", icons: variant === "icons" ? "1" : "", items, footnote: a.footnote ?? "", howtoName: a.howto ?? "" };
    },
    collect: (data, seo) => {
      // opt-in HowTo via <e-steps howto="Name of guide">
      const name = String((data as { howtoName?: string }).howtoName ?? "");
      if (!name) return;
      const steps = (data as { items: Array<{ title: string; body: string }> }).items;
      seo.addHowTo(
        name,
        steps.map((s) => ({ name: s.title, text: s.body.replace(/<[^>]+>/g, "").trim() })),
      );
    },
  },

  // ── points ──
  {
    templateName: "e-points",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["checks", "cols", "numbered", "dots"].includes(a.variant)
        ? a.variant
        : "checks";
      const items = byTag(api.node, "li").map((li, i) => {
        const strong = byTag(li, "strong")[0];
        const title = strong ? strong.innerHTML : li.textContent?.trim() || "";
        let text = "";
        let body = "";
        if (strong) {
          const cloneText = li.textContent?.trim() || "";
          text = cloneText.slice(strong.textContent?.trim().length ?? 0).trim();
          // for the cols variant, preserve the full innerHTML so nested lists/svgs survive
          if (variant === "cols") {
            const cloned = li.cloneNode?.(true) ?? li;
            const st = byTag(cloned, "strong")[0];
            if (st?.remove) st.remove();
            body = cloned.innerHTML.trim();
          }
        } else if (variant === "cols") {
          body = li.innerHTML.trim();
        }
        const mark =
          variant === "checks"
            ? "✓"
            : variant === "numbered"
              ? String(i + 1).padStart(2, "0")
              : variant === "dots"
                ? ""
                : "";
        return { mark, title, text, body };
      });
      return { variant, checks: variant === "checks" ? "1" : "", cols: variant === "cols" ? "1" : "", numbered: variant === "numbered" ? "1" : "", dots: variant === "dots" ? "1" : "", items };
    },
  },

  // ── logos ──
  {
    templateName: "e-logos",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["bar", "grid", "pills", "cluster"].includes(a.variant) ? a.variant : "bar";
      return { variant, bar: variant === "bar" ? "1" : "", grid: variant === "grid" ? "1" : "", pills: variant === "pills" ? "1" : "", cluster: variant === "cluster" ? "1" : "", inner: api.node.innerHTML, caption: a.caption ?? "" };
    },
  },

  // ── faq ──
  {
    templateName: "e-faq",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["accordion", "cards", "list", "compact"].includes(a.variant)
        ? a.variant
        : "accordion";
      const items = byTag(api.node, "details").map((d, i) => ({
        accordion: variant === "accordion",
        num: variant === "list" ? String(i + 1).padStart(2, "0") : "",
        q: d.querySelector("summary")?.innerHTML?.trim() ?? "",
        a:
          kids(d)
            .filter((el) => el.tagName.toLowerCase() !== "summary")
            .map((el) => el.outerHTML)
            .join("") || "",
      }));
      return { variant, accordion: variant === "accordion" ? "1" : "", cards: variant === "cards" ? "1" : "", list: variant === "list" ? "1" : "", compact: variant === "compact" ? "1" : "", items };
    },
    collect: (data, seo) => {
      for (const item of (data.items ?? []) as Array<{ q: string; a: string }>) {
        seo.addFaq(item.q.replace(/<[^>]+>/g, "").trim(), item.a.replace(/<[^>]+>/g, "").trim());
      }
    },
  },

  // ── tables ──
  {
    templateName: "e-table",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["savings", "matrix", "changelog", "pricing"].includes(a.variant)
        ? a.variant
        : "savings";
      const table = byTag(api.node, "table")[0];
      if (!table) return { variant, savings: variant === "savings" ? "1" : "", matrix: variant === "matrix" ? "1" : "", changelog: variant === "changelog" ? "1" : "", pricing: variant === "pricing" ? "1" : "", colCount: 0, cols: [], rows: [], foot: [] };

      const headRow = table.querySelector("thead tr");
      const cols: Array<{ text: string; alignCls: string; hasExplicitAlign: boolean }> = [];
      if (headRow) {
        for (const th of kids(headRow)) {
          const raw = attr(th, "align");
          const align = raw === "right" ? "right" : raw === "center" ? "center" : raw === "left" ? "left" : "";
          cols.push({ text: th.innerHTML, alignCls: align ? `align-${align}` : "", hasExplicitAlign: raw !== null });
        }
      }

      // per-variant column styling
      const monoCols = new Set<number>();
      if (variant === "savings") {
        for (let i = 1; i < cols.length; i++) monoCols.add(i);
      } else if (variant === "changelog") {
        monoCols.add(1);
      }
      const centerCols = new Set<number>();
      if (variant === "matrix" || variant === "pricing") {
        for (let i = 1; i < cols.length; i++) centerCols.add(i);
      }
      // make header align match cell fallback so matrix/pricing stay centered even when th lacks explicit align, but respect explicit left
      for (let i = 0; i < cols.length; i++) {
        if (!cols[i].alignCls && !cols[i].hasExplicitAlign && centerCols.has(i)) cols[i].alignCls = "align-center";
      }

      const tbody = table.querySelector("tbody");
      const bodyRows = tbody ? byTag(tbody, "tr") : [];
      const rows = bodyRows.map((tr) => ({
        cells: byTag(tr, "td").map((td, ci) => {
          const raw = attr(td, "align");
          const tdAlign = raw === "right" ? "align-right" : raw === "center" ? "align-center" : raw === "left" ? "align-left" : "";
          const hasTdAlign = raw !== null;
          const headerAlign = cols[ci]?.alignCls ?? "";
          const fallbackCenter = centerCols.has(ci) ? "align-center" : "";
          return {
            text: td.innerHTML,
            mono: monoCols.has(ci),
            alignCls: hasTdAlign ? tdAlign : (headerAlign || fallbackCenter),
          };
        }),
      }));
      const tfoot = table.querySelector("tfoot tr");
      const foot: Array<{ text: string; alignCls: string; mono: boolean }> = tfoot
        ? byTag(tfoot, "td").map((td, ci) => {
            const raw = attr(td, "align");
            const tdAlign = raw === "right" ? "align-right" : raw === "center" ? "align-center" : raw === "left" ? "align-left" : "";
            const hasTdAlign = raw !== null;
            const headerAlign = cols[ci]?.alignCls ?? "";
            const fallbackCenter = centerCols.has(ci) ? "align-center" : "";
            return { text: td.innerHTML, alignCls: hasTdAlign ? tdAlign : (headerAlign || fallbackCenter), mono: monoCols.has(ci) };
          })
        : [];

      return { variant, savings: variant === "savings" ? "1" : "", matrix: variant === "matrix" ? "1" : "", changelog: variant === "changelog" ? "1" : "", pricing: variant === "pricing" ? "1" : "", colCount: cols.length, cols, rows, foot };


    },
  },

  // ── CTA ──
  {
    templateName: "e-cta",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["band", "split", "inline", "cards"].includes(a.variant) ? a.variant : "band";
      const flag = (v: string) => (variant === v ? v : "");
      return {
        band: flag("band"),
        split: flag("split"),
        inline: flag("inline"),
        cards: flag("cards"),
        pill: a.pill ?? "",
        title: api.child("h2") ?? attr(api.node, "title") ?? "",
        sub: api.slot("sub") ?? "",
        actions: api.slot("actions") ?? "",
        meta: a.meta ?? "",
        cardsHtml: variant === "cards" ? api.node.innerHTML : "",
      };
    },
  },

  // ── sections ──
  {
    templateName: "e-section",
    mapper: (api) => {
      const a = api.attrs();
      const titleHtml = api.child("h2") ?? a.title ?? "";
      const leadHtml = api.slot("lead") ?? a.lead ?? "";
      const hasHead = Boolean(a.eyebrow || titleHtml || leadHtml);
      // body children: everything except slot-marked nodes and the h2 consumed as title
      let h2Skipped = false;
      const inner = unslotted(api.node)
        .filter((el) => {
          if (!h2Skipped && el.tagName.toLowerCase() === "h2" && api.child("h2") !== undefined) {
            h2Skipped = true;
            return false;
          }
          return true;
        })
        .map((el) => el.outerHTML)
        .join("\n");
      return {
        isSection: "1",
        warm: (attr(api.node, "warm") ?? null) !== null ? "1" : "",
        tight: (attr(api.node, "tight") ?? null) !== null ? "1" : "",
        idAttr: a.id ? ` id="${a.id}"` : "",
        eyebrow: a.eyebrow ?? "",
        titleHtml,
        leadHtml,
        hasHead: hasHead ? "1" : "",
        inner,
      };
    },
  },

  // ── progress line ──
  {
    templateName: "e-progress-line",
    mapper: (api) => {
      const a = api.attrs();
      const value = a.value ?? "";
      const fill =
        a.fill !== undefined && a.fill !== null && a.fill !== ""
          ? Math.max(0, Math.min(100, parseInt(a.fill, 10)))
          : Math.max(0, Math.min(100, Math.round((((parseInt(value, 10) || 0) - 40) / 55) * 100)));
      const label = a.label ?? "";
      return { label, value, fill, caption: a.caption ?? "", ariaLabel: label || value };
    },
  },

  // ── proof rows / fine print ──
  {
    templateName: "e-example",
    mapper: (api) => {
      const a = api.attrs();
      return {
        file: a.file ?? "",
        range: `${a.before ?? ""} → ${a.after ?? ""}`,
        save: a.save ?? "",
      };
    },
  },
  {
    templateName: "e-note",
    mapper: (api) => ({
      center: (attr(api.node, "center") ?? null) !== null ? "note--center" : "",
      text: api.node.innerHTML,
    }),
  },

  // ── downloads page (data-driven) ──
  {
    templateName: "e-releases",
    mapper: (api) => ({ items: releaseItems(api.ctx.data) }),
  },
  {
    templateName: "e-release-hero",
    mapper: (api) => {
      const a = api.attrs();
      const items = releaseItems(api.ctx.data);
      const latest = items[0];
      const limit = parseInt(a.limit || "7", 10);
      return {
        eyebrow: a.eyebrow ?? "",
        titleHtml: api.child("h1") ?? a.title ?? "",
        leadHtml: api.slot("lead") ?? "",
        actions: api.slot("actions") ?? "",
        latestTag: latest?.versionTag ?? `v${site.version}`,
        latestDate: latest ? stripVersionSuffix(latest.metaLine) : "",
        count: items.length,
        countLabel: `${items.length} release${items.length === 1 ? "" : "s"}`,
        jumpItems: items.slice(0, limit).map((r) => ({ id: r.id, tag: r.versionTag })),
      };
    },
  },
  {
    templateName: "e-release-filter",
    mapper: () => ({}),
  },

  // ── splits ──
  {
    templateName: "e-split",
    mapper: (api) => {
      const a = api.attrs();
      const allowed = ["narrow", "card", "editor", "alternating", "content-card"];
      const raw = a.variant ?? "narrow";
      const variant = allowed.includes(raw) ? raw : "narrow";
      const isCard = variant === "card";
      const effective = isCard ? "narrow" : variant;
      return {
        variant: effective,
        narrow: effective === "narrow" ? "1" : "",
        isCard: isCard ? "1" : "",
        editor: variant === "editor" ? "1" : "",
        alternating: variant === "alternating" ? "1" : "",
        "content-card": variant === "content-card" ? "1" : "",
        list: api.slotOuter("list") ?? "",
        card: api.slot("card") ?? "",
        media: api.slotOuter("media") ?? "",
        copy: api.slot("copy") ?? "",
      };
    },
  },
  // ── content ──
  {
    templateName: "e-content",
    mapper: (api) => {
      const a = api.attrs();
      const variant = ["editorial", "docs", "explainer", "kb"].includes(a.variant as string) ? (a.variant as string) : "editorial";
      const prose = unslotted(api.node)
        .filter((el) => el.tagName.toLowerCase() !== "h2")
        .map((el) => el.outerHTML)
        .join("\n");
      return {
        eyebrow: a.eyebrow ?? "",
        title: api.child("h2")?.trim() ?? "",
        lead: api.slot("lead") ?? "",
        prose,
        toc: api.slot("toc") ?? api.slotOuter("toc") ?? "",
        search: api.slot("search") ?? "",
        variant,
        editorial: variant === "editorial" ? "1" : "",
        docs: variant === "docs" ? "1" : "",
        explainer: variant === "explainer" ? "1" : "",
        kb: variant === "kb" ? "1" : "",
      };
    },
  },

  // ── demo-head — section-library only (replicates design/demo-label) ──
  {
    templateName: "e-demo-head",
    mapper: (api) => {
      const a = api.attrs();
      return {
        num: a.num ?? "",
        title: a.title ?? "",
        meta: a.meta ?? "",
      };
    },
  },

  // ── gap — contract-compliant spacer (replaces content-free headings) ──
  {
    templateName: "e-gap",
    mapper: (api) => {
      const size = api.attrs().size ?? "";
      const allowed = ["xs", "sm", "md", "lg", "xl", "section"];
      return { size: allowed.includes(size) ? size : "" };
    },
  },

  // ── comparison — before/after card matrix (design/examples.html) ──
  {
    templateName: "e-comparison",
    mapper: (api) => {
      const a = api.attrs();
      const items = byTag(api.node, "e-compare-item").map((el) => {
        const cells = byTag(el, "e-compare-cell").map((cellEl, ci) =>
          api.render("e-comparison-cell", compareCellData(cellEl, ci === 1)),
        ).join("");
        return api.render("e-comparison-item", { cells });
      }).join("");
      return {
        items,
        beforeLabel: a.beforeLabel ?? a["before-label"] ?? "Original",
        afterLabel: a.afterLabel ?? a["after-label"] ?? "Compressed",
        beforeTag: a.beforeTag ?? a["before-tag"] ?? "Before",
        afterTag: a.afterTag ?? a["after-tag"] ?? "After",
      };
    },
  },
];
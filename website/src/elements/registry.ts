import Mustache from "mustache";
import type { SiteConfig } from "../config";

/**
 * Bump when mapper/partial logic changes in a way the rev hash can't see
 * History: 2 — Phase C/D mappers finalized (slotOuter, table cells wrap).
 *          3 — classless extraction pass (e-section/e-formats/e-quality/
 *              e-example/e-note/e-proof/e-cell; ElementApi.render).
 *          4 — downloads scope (e-releases/e-release-hero/e-release-filter;
 *              ExpandContext.data; nav active flags).
 *          5 — grid aliases (e-grid-feature/proof/bento/dense) for design/grids.html compliance.
 *          6 — demo-head + gap (section-library headings & contract-compliant spacers).
 *          7 — design-fidelity pass: releases foot/compact variants, changelog mono col,
 *              faq minus/plus svg, cta warm pill, mock folder icon.
 *          8 — design-vs-element audit fixes: faq list mono numerals + compact 3-col
 *              mono-eyebrow; cta split meta inside panel; table tfoot summary; strip
 *              variant drops unstyled statstrip__item; split--card added; bento--cols-4
 *              added; grid-feature default omits dead cards--icons; steps icon support;
 *              points cols preserves innerHTML + dots 8px accent; logos caption as
 *              eyebrow above; content drops unstyled wrapper; releases omits asset
 *              icon when absent.
 *         12 — left align support (th/td align="left" → align-left) + header explicit-left respects fallback.
 *         11 — header fallback to centerCols for matrix/pricing so head and cells stay centered when th lacks explicit align.
 *         10 — table cell alignment matches header (td align → header align → centerCols fallback) + foot mirrors same chain.
 *          9 — visual-audit regressions caught on /sections/ via BrowserOS neo:
 *              e-content mapper filters h2 out of prose so titles render once
 *              (was duplicated); e-points template uses inverted body/title+text
 *              sections so cols variant never prints its content twice. revFor()
 *              hashes templates but not mappers — these mapper + template edits
 *              are invisible to the per-page source hash, so bump the version
 *              to invalidate the 30-day KV cache.
 *         13 — per-variant template files + missing design variants (e-content docs/explainer/kb, e-split editor/alternating, e-mock app)
 */
export const REGISTRY_VERSION = 13;
export interface ExpandContext {
  slug: string;
  path: string;
  site: SiteLike;
  /** preloaded JSON data files (public/data/*.json) keyed by name */
  data?: Record<string, unknown>;
}

export interface SeoCollector {
  addFaq(q: string, a: string): void;
  addHowTo(name: string, steps: Array<{ name: string; text: string }>): void;
}

/** Minimal structural DOM node type — keeps us independent of lib.dom vs workers-types. */
export interface DomNode {
  tagName: string;
  textContent: string | null;
  innerHTML: string;
  outerHTML: string;
  parentNode: DomNode | null;
  firstChild: DomNode | null;
  childNodes: Iterable<DomNode & { nodeType?: number }>;
  getAttribute(name: string): string | null;
  getAttributeNames(): string[];
  removeAttribute?(name: string): void;
  querySelectorAll(selector: string): DomNode[];
  remove?(): void;
  cloneNode?(deep?: boolean): DomNode;
}

export interface ElementApi {
  node: DomNode;
  ctx: ExpandContext;
  /** camelCased attributes of the element */
  attrs(): Record<string, string>;
  /** innerHTML of direct child with slot="name" (trusted HTML) */
  slot(name: string): string | undefined;
  /** outerHTML of direct child with slot="name" — keeps the element itself (e.g. a semantic <ul>) */
  slotOuter(name: string): string | undefined;
  /** Render an internal partial by name (for structured sub-templates) */
  render(name: string, data: Record<string, unknown>): string;
  /** innerHTML of first direct child <tag> (trusted HTML) */
  child(tag: string): string | undefined;
  /** outerHTML of first direct child <tag>, e.g. the whole <svg> icon */
  outer(tag: string): string | undefined;
  children(selector: string): DomNode[];
  /** trimmed textContent of the whole element */
  text(): string;
}

export interface ElementDef {
  /** partial name — must equal "e-<tag>" */
  templateName: string;
  mapper(api: ElementApi): Record<string, unknown>;
  collect?(data: Record<string, unknown>, seo: SeoCollector): void;
}

export interface Registry {
  defs: Map<string, ElementDef>;
  /** templateName -> mustache source (also feeds the KV rev hash) */
  sources: Record<string, string>;
  /** Render an element partial by name against its mapper output. */
  render(name: string, data: Record<string, unknown>): string;
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function makeApi(node: DomNode, ctx: ExpandContext): ElementApi {
  const kids = (): DomNode[] => Array.from(node.childNodes).filter((n) => n.nodeType === 1);
  return {
    node,
    ctx,
    attrs() {
      const out: Record<string, string> = {};
      for (const name of node.getAttributeNames()) out[camel(name)] = node.getAttribute(name) ?? "";
      return out;
    },
    slot(name) {
      for (const el of kids()) if (el.getAttribute("slot") === name) return el.innerHTML;
      return undefined;
    },
    slotOuter(name) {
      for (const el of kids()) if (el.getAttribute("slot") === name) return el.outerHTML;
      return undefined;
    },
    child(tag) {
      const t = tag.toLowerCase();
      for (const el of kids()) if (el.tagName.toLowerCase() === t) return el.innerHTML;
      return undefined;
    },
    outer(tag) {
      const t = tag.toLowerCase();
      for (const el of kids()) if (el.tagName.toLowerCase() === t) return el.outerHTML;
      return undefined;
    },
    children(selector) {
      return node.querySelectorAll(selector);
    },
    text() {
      return (node.textContent ?? "").trim();
    },
  };
}

/**
 * Build a registry from element definitions + their mustache sources.
 * Templates stay logic-less by contract: mappers compute, templates render.
 * Trusted HTML slots render via triple-stache {{{name}}} — escaping is the
 * default everywhere else.
 *
 * Sources ship into the worker bundle via wrangler Text rules (`rules` in
 * wrangler.jsonc); under `bun test`, test/hbs-preload.ts provides the loader.
 */
export function createRegistry(defs: ElementDef[], partials: Record<string, string>): Registry {
  const defsMap = new Map<string, ElementDef>();
  // all sources are available for api.render() — including internal partials
  // that have no registered element of their own (e.g. e-bento-cell).
  const sources: Record<string, string> = { ...partials };
  for (const def of defs) {
    const src = partials[def.templateName];
    if (!src) throw new Error(`registry: missing partial "${def.templateName}"`);
    defsMap.set(def.templateName.slice(2), def); // "e-pill" -> lookup key "pill"
  }
  return {
    defs: defsMap,
    sources,
    render(name, data) {
      const tpl = sources[name];
      if (typeof tpl !== "string") throw new Error(`registry: missing partial "${name}"`);
      return Mustache.render(tpl, data, sources);
    },
  };
}

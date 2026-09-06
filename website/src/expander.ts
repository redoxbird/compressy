import { parseHTML } from "linkedom";
import type {
  DomNode,
  ElementApi,
  ElementDef,
  ExpandContext,
  Registry,
  SeoCollector,
} from "./elements/registry";
import type { PageMeta } from "./meta";

export interface CollectedData {
  faqs: Array<{ q: string; a: string }>;
  howtos: Array<{ name: string; steps: Array<{ name: string; text: string }> }>;
}

export interface ExpandResult {
  /** expanded <body> inner HTML */
  body: string;
  meta: PageMeta;
  collected: CollectedData;
}

const ELEMENT_TYPE = 1;

function kids(node: DomNode): DomNode[] {
  return Array.from(node.childNodes).filter((n) => n.nodeType === ELEMENT_TYPE);
}

function makeApi(node: DomNode, ctx: ExpandContext, registry: Registry): ElementApi {
  const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return {
    node,
    ctx,
    attrs() {
      const out: Record<string, string> = {};
      for (const name of node.getAttributeNames())
        out[camel(name)] = node.getAttribute(name) ?? "";
      return out;
    },
    slot(name) {
      for (const el of kids(node)) if (el.getAttribute("slot") === name) return el.innerHTML;
      return undefined;
    },
    slotOuter(name) {
      for (const el of kids(node)) {
        if (el.getAttribute("slot") === name) {
          el.removeAttribute("slot");
          return el.outerHTML;
        }
      }
      return undefined;
    },
    child(tag) {
      const t = tag.toLowerCase();
      for (const el of kids(node)) if (el.tagName.toLowerCase() === t) return el.innerHTML;
      return undefined;
    },
    outer(tag) {
      const t = tag.toLowerCase();
      for (const el of kids(node)) if (el.tagName.toLowerCase() === t) return el.outerHTML;
      return undefined;
    },
    children(selector) {
      return node.querySelectorAll(selector);
    },
    text() {
      return (node.textContent ?? "").trim();
    },
    render(name, data) {
      return registry.render(name, data);
    },
  };
}

/** Replace `node` in its parent with rendered `html` (linkedom outerHTML setter). */
function replaceNode(node: DomNode, html: string): void {
  node.outerHTML = html;
}

/**
 * Expand every registered <e-*> element in an authored page, deepest-first so
 * slotted children resolve before their parents render. Unknown e-* tags are
 * left untouched (visible signal that an element is missing from the registry).
 *
 * Pure function of (source, ctx, registry) — no I/O, fully unit-testable.
 */
export function expandPage(source: string, ctx: ExpandContext, registry: Registry): ExpandResult {
  // linkedom requires a full document; tolerate bare-body authoring snippets
  const normalized = /<html[\s>]/i.test(source)
    ? source
    : /<body[\s>]/i.test(source)
      ? `<!doctype html><html><head></head>${source}</html>`
      : `<!doctype html><html><head></head><body>${source}</body></html>`;
  const { document } = parseHTML(normalized);
  if (!document?.body) {
    return { body: "", meta: {}, collected: { faqs: [], howtos: [] } };
  }

  // authored <head> data, read before anything mutates the tree
  const meta: PageMeta = {
    title: document.querySelector("title")?.textContent?.trim() || undefined,
    description:
      document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ||
      undefined,
    ogImage:
      document.querySelector('meta[property="og:image"]')?.getAttribute("content")?.trim() ||
      undefined,
  };

  const collected: CollectedData = { faqs: [], howtos: [] };
  const seo: SeoCollector = {
    addFaq(q, a) {
      collected.faqs.push({ q, a });
    },
    addHowTo(name, steps) {
      collected.howtos.push({ name, steps });
    },
  };

  // collect all e-* nodes with depth, then expand deepest-first
  const targets: Array<{ node: DomNode; depth: number }> = [];
  const walk = (node: DomNode, depth: number) => {
    for (const kid of kids(node)) {
      if (/^e-[a-z0-9-]+$/i.test(kid.tagName)) targets.push({ node: kid, depth: depth + 1 });
      walk(kid, depth + 1);
    }
  };
  walk(document.body, 0);
  targets.sort((a, b) => b.depth - a.depth);

  for (const { node } of targets) {
    const tag = node.tagName.toLowerCase().slice(2); // "e-pill" -> "pill"
    const def: ElementDef | undefined = registry.defs.get(tag);
    if (!def) continue; // unknown element: leave as-is
    if (!node.parentNode) continue;
    const data = def.mapper(makeApi(node, ctx, registry));
    def.collect?.(data, seo);
    replaceNode(node, registry.render(def.templateName, data));
  }

  return { body: document.body.innerHTML, meta, collected };
}

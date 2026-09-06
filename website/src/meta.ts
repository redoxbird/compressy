import type { SiteConfig } from "./config";

export interface PageMeta {
  title?: string;
  description?: string;
  ogImage?: string;
}

export interface ResolvedMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
}

/** Read authored <head> data before expansion destroys it. */
export function extractMeta(doc: {
  querySelector(sel: string): { textContent?: string | null; getAttribute(name: string): string | null } | null;
}): PageMeta {
  const title = doc.querySelector("title")?.textContent?.trim() || undefined;
  const description =
    doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || undefined;
  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content")?.trim() || undefined;
  return { title, description, ogImage };
}

/** Precedence: authored page override > site config default > derived fallbacks. */
export function resolveMeta(slug: string, extracted: PageMeta, site: SiteConfig): ResolvedMeta {
  const path = slug === "index" ? "/" : `/${slug}/`;
  return {
    title: extracted.title ?? `${site.brand.name} — ${site.brand.tagline}`,
    description: extracted.description ?? site.brand.tagline,
    canonical: `${site.url}${path}`,
    ogImage: `${site.url}${extracted.ogImage ?? site.seo.defaultOgImage}`,
  };
}

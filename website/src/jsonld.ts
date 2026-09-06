import type { CollectedData } from "./expander";
import type { SiteConfig } from "./config";

export interface JsonLdInput {
  site: SiteConfig;
  collected: CollectedData;
  slug: string;
  /** resolved page title — used for the current breadcrumb entry */
  title?: string;
}

/** Assemble structured-data blocks harvested during expansion + config facts. */
export function buildJsonLd({ site, collected, slug, title }: JsonLdInput): object[] {
  const blocks: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.brand.name,
      url: site.url,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: site.brand.name,
      operatingSystem: "Windows",
      applicationCategory: "UtilitiesApplication",
      description: site.brand.tagline,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      softwareVersion: site.version,
      downloadUrl: `${site.downloads.assetsBase}/${site.downloads.exePattern.replace("{version}", site.version)}`,
    },
  ];

  if (collected.faqs.length > 0) {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: collected.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  for (const howto of collected.howtos) {
    if (howto.steps.length === 0) continue;
    blocks.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: howto.name,
      step: howto.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    });
  }

  if (slug !== "index") {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: site.brand.name,
          item: site.url + "/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: title ?? slug,
        },
      ],
    });
  }

  return blocks;
}

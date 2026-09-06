import rawConfig from "./site.config.json";

export interface NavItem {
  label: string;
  href: string;
}

export interface SiteConfig {
  url: string;
  brand: { name: string; tagline: string };
  version: string;
  /** JSON data files in public/data/ preloaded for mappers */
  data?: string[];
  downloads: {
    /** R2 custom domain serving release assets */
    assetsBase: string;
    /** Pattern with {version} placeholder, e.g. "{version}/Compressy-setup.exe" */
    exePattern: string;
  };
  nav: NavItem[];
  seo: {
    defaultOgImage: string;
    twitter: string;
    locale: string;
  };
}

export const site = rawConfig as SiteConfig;

/** Versioned installer URL, e.g. https://assets.compressy.app/1.4.2/Compressy-setup.exe */
export function downloadUrl(version: string = site.version): string {
  return `${site.downloads.assetsBase}/${site.downloads.exePattern.replace("{version}", version)}`;
}

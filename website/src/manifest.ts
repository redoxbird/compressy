/**
 * Page manifest — the single list of published slugs.
 * Drives sitemap.xml, robots.txt and the sync test against public/*.html.
 * Adding a landing page = drop public/{slug}.html + add its slug here.
 */
export const SLUGS: readonly string[] = ["index", "downloads", "sections", "sitemap", "compress-image", "compress-jpg", "compress-jpeg", "compress-png", "compress-webp", "compress-avif", "reduce-image-size", "image-optimizer", "photo-compressor", "compress-image-to-50kb", "compress-image-to-100kb", "compress-image-to-200kb", "compress-image-to-500kb", "compress-image-to-1mb", "resize-image", "benchmarks", "jpg-to-webp", "png-to-webp", "jpeg-to-webp", "jpg-to-avif", "png-to-avif", "webp-to-jpg", "compress-images-without-losing-quality", "compress-images-for-websites", "compress-images-for-wordpress", "compress-images-for-email", "compress-images-for-amazon", "compress-images-for-etsy", "compress-images-for-instagram", "offline-image-compressor", "image-compressor-without-uploading", "private-image-compressor", "image-compressor-for-windows", "windows-image-compressor", "examples"];

/** Canonical public path for a slug (index serves "/"). */
export function publicPath(slug: string): string {
  return slug === "index" ? "/" : `/${slug}/`;
}

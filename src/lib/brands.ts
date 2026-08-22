export type BrandSlug = "araz" | "elring" | "aplus-automotive";

export type Brand = {
  slug: BrandSlug;
  name: string;
  /**
   * Path to the brand's logo image. Once set (via the future admin panel,
   * when a brand is assigned to a product), it's shown as an overlay badge
   * on that product's photos in place of the text fallback.
   */
  logo?: string;
};

export const brands: Brand[] = [
  { slug: "araz", name: "Araz" },
  { slug: "elring", name: "Elring" },
  { slug: "aplus-automotive", name: "APLUS AUTOMOTIVE" },
];

/**
 * Brands shown on the public Brands page and offered in the brand filter.
 * Excludes "araz" — that's the shop's own name, not a carried parts brand.
 */
export const catalogBrands: Brand[] = brands.filter((b) => b.slug !== "araz");

export function getBrandBySlug(slug: string): Brand | undefined {
  return brands.find((b) => b.slug === slug);
}

export function isBrandSlug(value: string): value is BrandSlug {
  return brands.some((b) => b.slug === value);
}

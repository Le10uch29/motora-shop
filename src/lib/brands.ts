import { createPublicClient } from "@/lib/supabase/public";

export type BrandSlug = string;

export type Brand = {
  slug: BrandSlug;
  name: string;
  /** Full logo for the brand card on /brands. */
  logoUrl: string | null;
  /** Compact badge overlaid on product photos for this brand. */
  badgeLogoUrl: string | null;
};

function mapRow(row: {
  slug: string;
  name: string;
  logo_url: string | null;
  badge_logo_url: string | null;
}): Brand {
  return {
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    badgeLogoUrl: row.badge_logo_url,
  };
}

export async function getBrands(): Promise<Brand[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("brands")
    .select("slug, name, logo_url, badge_logo_url")
    .order("name");
  return (data ?? []).map(mapRow);
}

/**
 * Brands shown on the public Brands page and offered in the brand filter.
 * Excludes "araz" — that's the shop's own name, not a carried parts brand.
 */
export async function getCatalogBrands(): Promise<Brand[]> {
  const all = await getBrands();
  return all.filter((b) => b.slug !== "araz");
}

export async function getBrandBySlug(slug: string): Promise<Brand | undefined> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("brands")
    .select("slug, name, logo_url, badge_logo_url")
    .eq("slug", slug)
    .maybeSingle();
  return data ? mapRow(data) : undefined;
}

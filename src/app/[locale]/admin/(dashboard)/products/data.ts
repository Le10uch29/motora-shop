import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/locales";
import type { LocalizedText, ProductSpec } from "@/lib/products";
import { fitmentsOf, type Fitment } from "@/lib/fitments";

export const PRODUCTS_PAGE_SIZE = 30;

export type AdminProductRow = {
  id: string;
  slug: string;
  make: string;
  model: string;
  fitments: Fitment[];
  brandId: string;
  brandName: string;
  yearFrom: number;
  yearTo: number;
  price: number;
  oldPrice: number | null;
  stock: number;
  originCode: string;
  productCode: string;
  name: LocalizedText;
  description: LocalizedText;
  specs: ProductSpec[];
  badge: LocalizedText | null;
  images: string[];
  isPopular: boolean;
  displayName: string;
};

type ProductRow = {
  id: string;
  slug: string;
  make: string;
  model: string | null;
  fitments: Fitment[] | null;
  brand_id: string | null;
  year_from: number;
  year_to: number;
  price: number;
  old_price: number | null;
  stock: number;
  origin_code: string | null;
  product_code: string | null;
  name: LocalizedText;
  description: LocalizedText;
  specs: ProductSpec[] | null;
  badge: LocalizedText | null;
  images: string[] | null;
  is_popular: boolean;
  brands: { name: string } | { name: string }[] | null;
};

export async function getBrandOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("id, name").order("name");
  return data ?? [];
}

/** Unfiltered count of every product — distinct from getAdminProducts's
 * `total`, which reflects the current search query. The "delete all
 * products" confirmation needs the true grand total, since that action
 * always wipes the whole catalog regardless of any active search filter. */
export async function getProductsGrandTotal(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** How many products have nothing in stock — shown before an admin deletes them. */
export async function getZeroStockProductsCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .lte("stock", 0);
  return count ?? 0;
}

/** The fields one search word may match, as a PostgREST or-filter.
 *
 * Brand names live in another table, so the brands matching the word are
 * resolved to ids first and added as one more alternative — the same trick the
 * catalog search uses for localized make labels. */
function adminSearchClause(word: string, locale: Locale, brandIds: string[]): string | null {
  // PostgREST's filter-string syntax breaks on these in a raw value.
  const safe = word.replace(/[,()]/g, "").trim();
  if (!safe) return null;

  const parts = [
    `name->>${locale}.ilike.%${safe}%`,
    `product_code.ilike.%${safe}%`,
    `origin_code.ilike.%${safe}%`,
    `make.ilike.%${safe}%`,
    `model.ilike.%${safe}%`,
  ];
  if (brandIds.length > 0) parts.push(`brand_id.in.(${brandIds.join(",")})`);
  return parts.join(",");
}

/** One page of the admin product list, searched, counted and sliced by
 * Postgres itself.
 *
 * It used to fetch every product with every column and do all three in JS.
 * That was the slowest page on the site — around a second of pure waiting with
 * a few hundred products, and getting worse with each import. */
export async function getAdminProducts(
  locale: Locale,
  options: { query?: string; page?: number } = {}
): Promise<{ rows: AdminProductRow[]; total: number }> {
  const supabase = await createClient();

  const words = options.query?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  // Only a search needs the brand names, and the table is tiny.
  const brands = words.length > 0 ? await getBrandOptions() : [];

  let query = supabase
    .from("products")
    .select(
      "id, slug, make, model, fitments, brand_id, year_from, year_to, price, old_price, stock, origin_code, product_code, name, description, specs, badge, images, is_popular, brands(name)",
      { count: "exact" }
    );

  for (const word of words) {
    const brandIds = brands.filter((b) => b.name.toLowerCase().includes(word)).map((b) => b.id);
    const clause = adminSearchClause(word, locale, brandIds);
    if (clause) query = query.or(clause);
  }

  const page = options.page && options.page > 0 ? options.page : 1;
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  // `id` breaks ties for the same reason it does in the catalog: a bulk import
  // gives hundreds of products the identical created_at, and without a
  // tiebreaker Postgres may order equal rows differently per query, so pages
  // would overlap and skip rows.
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + PRODUCTS_PAGE_SIZE - 1);

  const rows: AdminProductRow[] = ((data ?? []) as unknown as ProductRow[]).map((p) => {
    const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands;
    return {
      id: p.id,
      slug: p.slug,
      make: p.make,
      model: p.model ?? "",
      fitments: fitmentsOf({ ...p, yearFrom: p.year_from, yearTo: p.year_to }),
      brandId: p.brand_id ?? "",
      brandName: brand?.name ?? "—",
      yearFrom: p.year_from,
      yearTo: p.year_to,
      price: p.price,
      oldPrice: p.old_price,
      stock: p.stock,
      originCode: p.origin_code ?? "",
      productCode: p.product_code ?? "",
      name: p.name,
      description: p.description,
      specs: p.specs ?? [],
      badge: p.badge,
      images: p.images ?? [],
      isPopular: p.is_popular,
      displayName: p.name?.[locale] ?? p.name?.ru ?? "",
    };
  });

  return { rows, total: count ?? 0 };
}

import { cache } from "react";
import type { Locale } from "@/i18n/locales";
import type { BrandSlug } from "@/lib/brands";
import { createPublicClient } from "@/lib/supabase/public";

export type LocalizedText = Record<Locale, string>;

export type ProductSpec = { label: LocalizedText; value: LocalizedText };

export type Product = {
  id: string;
  slug: string;
  name: LocalizedText;
  /** Vehicle make this part fits, as a key into {@link makeLabels}. "universal" if not make-specific. */
  make: string;
  /** Vehicle model (and chassis code, where relevant) this part fits. */
  model: string;
  /** Parts brand carried by the shop. */
  brand: BrandSlug;
  /** Inclusive vehicle model-year range this part fits. */
  yearFrom: number;
  yearTo: number;
  /** Base price in Georgian Lari (GEL) */
  price: number;
  oldPrice?: number;
  description: LocalizedText;
  specs: ProductSpec[];
  /** Units currently in stock. 0 means made-to-order. */
  stock: number;
  badge?: LocalizedText;
  /** Shown in the "Popular" section on the home page. */
  isPopular: boolean;
  /** Up to 4 photo URLs. */
  images?: string[];
  /** Manufacturer's original reference code. */
  originCode?: string;
  /** Shop's internal product code. */
  productCode?: string;
};

export function t(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

/** Vehicle makes referenced by {@link Product.make}, keyed by a stable locale-independent id. */
export const makeLabels: Record<string, LocalizedText> = {
  toyota: { ru: "Toyota", az: "Toyota", ka: "Toyota" },
  hyundai: { ru: "Hyundai", az: "Hyundai", ka: "Hyundai" },
  "mercedes-benz": { ru: "Mercedes-Benz", az: "Mercedes-Benz", ka: "Mercedes-Benz" },
  man: { ru: "MAN", az: "MAN", ka: "MAN" },
  kamaz: { ru: "КАМАЗ", az: "KamAZ", ka: "КАМАЗ" },
  zil: { ru: "ЗИЛ", az: "ZİL", ka: "ЗИЛ" },
  universal: { ru: "Универсальный", az: "Universal", ka: "უნივერსალური" },
};

export function makeLabel(makeId: string, locale: Locale): string {
  const label = makeLabels[makeId];
  return label ? t(label, locale) : makeId;
}

/** Localizes and alphabetically sorts a list of make ids for display (e.g. in a filter dropdown). */
export function localizedMakes(
  makeIds: string[],
  locale: Locale
): { id: string; label: string }[] {
  return makeIds
    .map((id) => ({ id, label: makeLabel(id, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

type ProductRow = {
  id: string;
  slug: string;
  name: LocalizedText;
  make: string;
  model: string | null;
  year_from: number;
  year_to: number;
  price: number;
  old_price: number | null;
  description: LocalizedText;
  specs: ProductSpec[] | null;
  stock: number;
  badge: LocalizedText | null;
  images: string[] | null;
  origin_code: string | null;
  product_code: string | null;
  is_popular: boolean;
  brands: { slug: string } | { slug: string }[] | null;
};

const SELECT_COLUMNS =
  "id, slug, name, make, model, year_from, year_to, price, old_price, description, specs, stock, badge, images, origin_code, product_code, is_popular, brands(slug)";

function mapRow(row: ProductRow): Product {
  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    make: row.make,
    model: row.model ?? "",
    brand: brand?.slug ?? "",
    yearFrom: row.year_from,
    yearTo: row.year_to,
    price: Number(row.price),
    oldPrice: row.old_price != null ? Number(row.old_price) : undefined,
    description: row.description,
    specs: row.specs ?? [],
    stock: row.stock,
    badge: row.badge ?? undefined,
    images: row.images ?? undefined,
    originCode: row.origin_code ?? undefined,
    productCode: row.product_code ?? undefined,
    isPopular: row.is_popular,
  };
}

/** Percent off, rounded, when `oldPrice` is a valid crossed-out reference price. Undefined otherwise. */
export function discountPercent(product: Product): number | undefined {
  if (!product.oldPrice || product.oldPrice <= product.price) return undefined;
  return Math.round((1 - product.price / product.oldPrice) * 100);
}

// cache() dedupes identical calls within a single request/render — e.g. the
// root layout's Header and a page component both asking for the full
// product list only hit Supabase once, not twice.
export const getAllProducts = cache(async (): Promise<Product[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as ProductRow[]).map(mapRow);
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | undefined> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return data ? mapRow(data as unknown as ProductRow) : undefined;
});

/** Up to `limit` products flagged "popular" — for the home page's featured
 * section, which never needs more than a handful. Filtered in the DB query
 * itself instead of fetching the whole catalog (potentially hundreds of
 * rows, each with a 3-language name/description and an images array) just
 * to throw away everything but 4 of them client-side. */
export const getFeaturedProducts = cache(async (limit = 4): Promise<Product[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT_COLUMNS)
    .eq("is_popular", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as ProductRow[]).map(mapRow);
});

// `!inner` makes PostgREST actually filter top-level rows by the embedded
// resource's column — without it, .eq("brands.slug", …) is silently ignored.
const SELECT_COLUMNS_BRAND_FILTER = SELECT_COLUMNS.replace("brands(slug)", "brands!inner(slug)");

/** All products of one brand, filtered in the DB query — for a brand's own
 * page, which otherwise had no reason to pull every other brand's products
 * across the wire just to filter them out client-side. */
export const getProductsByBrandSlug = cache(async (brandSlug: string): Promise<Product[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT_COLUMNS_BRAND_FILTER)
    .eq("brands.slug", brandSlug)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as ProductRow[]).map(mapRow);
});

/** Product count per brand slug, computed from a single skinny query (just
 * the brand join, none of the other ~15 columns) instead of fetching every
 * product's full row for the /brands listing page. */
export const getProductCountsByBrandSlug = cache(async (): Promise<Record<string, number>> => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("products").select("brands(slug)");
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { brands: { slug: string } | { slug: string }[] | null }[]) {
    const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
    if (brand?.slug) counts[brand.slug] = (counts[brand.slug] ?? 0) + 1;
  }
  return counts;
});

export type CartProductSummary = Pick<Product, "id" | "slug" | "name" | "price" | "stock">;

/** Just the columns the cart view renders (name, price, stock) instead of
 * every product's full row. The cart itself lives in the browser's
 * localStorage, so the server can't know in advance which product ids to
 * filter for — this still has to fetch every product, but a much lighter
 * row: no description, specs, images, or badge. */
export const getProductsForCart = cache(async (): Promise<CartProductSummary[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("products").select("id, slug, name, price, stock");
  return (data ?? []) as CartProductSummary[];
});

/** Models grouped by make, both derived live from whatever products
 * currently exist — a make/model with no products left simply isn't in the
 * result, and reappears the moment a matching product is added again. */
export function computeModelsByMake(products: { make: string; model: string }[]): Record<string, string[]> {
  const byMake: Record<string, Set<string>> = {};
  for (const p of products) {
    if (!p.model) continue;
    (byMake[p.make] ??= new Set()).add(p.model);
  }
  const result: Record<string, string[]> = {};
  for (const [make, models] of Object.entries(byMake)) {
    result[make] = Array.from(models).sort((a, b) => a.localeCompare(b));
  }
  return result;
}

/** One word of a search query, turned into a PostgREST `or=` clause covering
 * the same fields {@link filterProducts} matches on. The words of a query are
 * ANDed (one `.or()` call each) while the fields inside a word are ORed, so
 * "toyota camry" finds a Toyota Camry part the way the in-JS substring match
 * used to — searching for the make and the model at once still works even
 * though they live in different columns. */
function searchClauseForWord(word: string, locale: Locale): string | null {
  // PostgREST's filter-string syntax breaks on these in a raw value.
  const safe = word.replace(/[,()]/g, "").trim();
  if (!safe) return null;

  const parts = [
    `name->>${locale}.ilike.%${safe}%`,
    `description->>${locale}.ilike.%${safe}%`,
    `product_code.ilike.%${safe}%`,
    `origin_code.ilike.%${safe}%`,
    `make.ilike.%${safe}%`,
    `model.ilike.%${safe}%`,
  ];

  // "Мерседес" has to find make "mercedes-benz": the localized label only
  // exists in the app, so it's resolved to make ids before querying.
  const matchingMakeIds = Object.keys(makeLabels).filter((id) =>
    t(makeLabels[id], locale).toLowerCase().includes(safe)
  );
  if (matchingMakeIds.length > 0) parts.push(`make.in.(${matchingMakeIds.join(",")})`);

  return parts.join(",");
}

/** One page of the catalog, filtered, counted and sliced by Postgres itself.
 *
 * The whole catalog used to be fetched and then filtered and paginated in JS —
 * with a few hundred products that meant ~250 KB and well over a second of
 * every catalog render just to show 12 cards. Everything here maps 1:1 onto
 * what {@link filterProducts} did, so results stay the same; only the place
 * the work happens changed. */
export async function getCatalogPage(
  filters: ProductFilters,
  locale: Locale,
  page: number,
  pageSize: number
): Promise<{ items: Product[]; total: number }> {
  const supabase = createPublicClient();

  let brandId: string | undefined;
  if (filters.brand) {
    // Resolved to an id rather than filtering through `brands!inner(slug)`:
    // an inner join would also drop products whose brand was deleted, which
    // the old in-JS filter kept visible whenever no brand filter was active.
    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", filters.brand)
      .maybeSingle();
    if (!brandRow) return { items: [], total: 0 };
    brandId = brandRow.id;
  }

  let query = supabase.from("products").select(SELECT_COLUMNS, { count: "exact" });

  if (brandId) query = query.eq("brand_id", brandId);
  if (filters.make) query = query.eq("make", filters.make);
  if (filters.model) query = query.eq("model", filters.model);
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  // A part fits the wanted years when its own range overlaps them.
  if (filters.yearFrom !== undefined) query = query.gte("year_to", filters.yearFrom);
  if (filters.yearTo !== undefined) query = query.lte("year_from", filters.yearTo);

  for (const word of filters.query?.trim().toLowerCase().split(/\s+/) ?? []) {
    const clause = searchClauseForWord(word, locale);
    if (clause) query = query.or(clause);
  }

  const safePage = page > 0 ? page : 1;
  const from = (safePage - 1) * pageSize;
  // `id` breaks ties, and it has to: a bulk Excel import writes hundreds of
  // products with the identical created_at, and Postgres is free to return
  // equal rows in any order it likes per query. Ordering by created_at alone
  // therefore made .range() pages overlap and skip products — paging through
  // the catalog showed some twice and hid others entirely. This didn't come
  // up while the whole catalog was fetched and sliced in one go.
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  return { items: ((data ?? []) as unknown as ProductRow[]).map(mapRow), total: count ?? 0 };
}

/** Just the slugs, for generateStaticParams — it builds a route per product
 * per locale and needs nothing but the slug. */
export const getAllProductSlugs = cache(async (): Promise<string[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("products").select("slug");
  return (data ?? []).map((row) => row.slug);
});

export type ProductFilters = {
  make?: string;
  model?: string;
  brand?: BrandSlug;
  priceMin?: number;
  priceMax?: number;
  yearFrom?: number;
  yearTo?: number;
  query?: string;
};

export function filterProducts(
  products: Product[],
  filters: ProductFilters,
  locale: Locale
): Product[] {
  const query = filters.query?.trim().toLowerCase();
  return products.filter((p) => {
    if (filters.make && p.make !== filters.make) return false;
    if (filters.model && p.model !== filters.model) return false;
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.priceMin !== undefined && p.price < filters.priceMin) return false;
    if (filters.priceMax !== undefined && p.price > filters.priceMax) return false;
    if (filters.yearFrom !== undefined && p.yearTo < filters.yearFrom) return false;
    if (filters.yearTo !== undefined && p.yearFrom > filters.yearTo) return false;
    if (query) {
      const haystack = `${t(p.name, locale)} ${t(p.description, locale)} ${p.productCode ?? ""} ${p.originCode ?? ""} ${p.make} ${makeLabel(p.make, locale)} ${p.model}`
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function computeCarMakes(products: { make: string }[]): string[] {
  return Array.from(new Set(products.map((p) => p.make))).sort((a, b) => a.localeCompare(b));
}

export function computePriceBounds(products: { price: number }[]): { min: number; max: number } {
  if (products.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...products.map((p) => p.price)),
    max: Math.max(...products.map((p) => p.price)),
  };
}

export function computeYearBounds(products: Product[]): { min: number; max: number } {
  if (products.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...products.map((p) => p.yearFrom)),
    max: Math.max(...products.map((p) => p.yearTo)),
  };
}

import { cache } from "react";
import type { Locale } from "@/i18n/locales";
import type { BrandSlug } from "@/lib/brands";
import { createPublicClient } from "@/lib/supabase/public";
import { fitmentsOf, type Fitment } from "@/lib/fitments";

export type LocalizedText = Record<Locale, string>;

export type ProductSpec = { label: LocalizedText; value: LocalizedText };

export type Product = {
  id: string;
  slug: string;
  name: LocalizedText;
  /** Every vehicle make this part fits, joined with "; " — for display and
   * search only; filtering goes by {@link fitments}. */
  make: string;
  /** Every vehicle model this part fits, joined with "; ". */
  model: string;
  /** The vehicles this part fits, each a make (a key into {@link makeLabels},
   * "universal" if not make-specific), a model and a year range. */
  fitments: Fitment[];
  /** Parts brand carried by the shop. */
  brand: BrandSlug;
  /** Inclusive model-year range spanning all of {@link fitments}. */
  yearFrom: number;
  yearTo: number;
  /** Base price in Georgian Lari (GEL) */
  price: number;
  oldPrice?: number;
  description: LocalizedText;
  specs: ProductSpec[];
  /** Units currently in stock. A product at 0 is never deleted, it just
   * disappears from the shop until it's restocked. */
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
  fitments: Fitment[] | null;
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
  "id, slug, name, make, model, fitments, year_from, year_to, price, old_price, description, specs, stock, badge, images, origin_code, product_code, is_popular, brands(slug)";

/* The shop only ever shows what's actually in stock, so every public query
 * below carries `.gt("stock", 0)`.
 *
 * A product that runs out isn't deleted — it keeps its history and its orders,
 * stays in the admin product list with a 0, and comes back on the site by
 * itself the moment the stock is topped up again. The admin panel's own
 * queries (src/app/[locale]/admin) deliberately have no such filter. */

function mapRow(row: ProductRow): Product {
  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    make: row.make,
    model: row.model ?? "",
    fitments: fitmentsOf({ ...row, yearFrom: row.year_from, yearTo: row.year_to }),
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
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as ProductRow[]).map(mapRow);
});

/** One product by slug, or undefined when it doesn't exist *or* is out of
 * stock — a sold-out product's page 404s like any unknown address, so a
 * bookmark or a link can't reach what the catalog no longer lists. */
/** How many products the shop has in stock, over the whole catalog.
 *
 * This is what "Все товары" counts in the category sidebar: it's the shop
 * itself, not the sum of the categories — products nobody has filed yet
 * belong to it too. */
export const getInStockProductCount = cache(async (): Promise<number> => {
  const supabase = createPublicClient();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .gt("stock", 0);
  return count ?? 0;
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | undefined> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .gt("stock", 0)
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
    .gt("stock", 0)
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
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as ProductRow[]).map(mapRow);
});

/** Product count per brand slug, computed from a single skinny query (just
 * the brand join, none of the other ~15 columns) instead of fetching every
 * product's full row for the /brands listing page. */
export const getProductCountsByBrandSlug = cache(async (): Promise<Record<string, number>> => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("products").select("brands(slug)").gt("stock", 0);
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

/** Whether one of a product's vehicles matches the wanted make and/or model —
 * both on the same vehicle, so a part for a MAZDA 6 and a BMW G30 isn't found
 * as a "MAZDA G30". The same rule {@link getCatalogPage} applies in the DB. */
function productFits(fitments: Fitment[], make: string | undefined, model: string | undefined): boolean {
  const wantedModel = model?.trim().toLowerCase();
  return fitments.some(
    (f) => (!make || f.make === make) && (!wantedModel || f.model.toLowerCase() === wantedModel)
  );
}

/** Models grouped by make, both derived live from whatever products
 * currently exist — a make/model with no products left simply isn't in the
 * result, and reappears the moment a matching product is added again. A
 * product fitting several vehicles lists each model under its own make. */
export function computeModelsByMake(products: { fitments: Fitment[] }[]): Record<string, string[]> {
  const byMake: Record<string, Set<string>> = {};
  for (const f of products.flatMap((p) => p.fitments)) {
    if (!f.model) continue;
    (byMake[f.make] ??= new Set()).add(f.model);
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
  // exists in the app, so it's resolved to make ids before querying. `make`
  // lists every make of the part, so each id is looked for inside it.
  const matchingMakeIds = Object.keys(makeLabels).filter((id) =>
    t(makeLabels[id], locale).toLowerCase().includes(safe)
  );
  for (const id of matchingMakeIds) parts.push(`make.ilike.%${id}%`);

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

  // No products at all in the chosen category: answer without asking the
  // database, since `.in("id", [])` would be a pointless round trip.
  if (filters.productIds && filters.productIds.length === 0) {
    return { items: [], total: 0 };
  }

  let query = supabase.from("products").select(SELECT_COLUMNS, { count: "exact" }).gt("stock", 0);

  if (filters.productIds) query = query.in("id", filters.productIds);
  if (brandId) query = query.eq("brand_id", brandId);
  // One vehicle of the part has to carry both the make and the model (jsonb
  // containment matches them within a single array element), so a part for a
  // MAZDA 6 and a BMW G30 doesn't turn up under "MAZDA G30".
  if (filters.make || filters.model) {
    const wanted: Partial<Fitment> = {};
    if (filters.make) wanted.make = filters.make;
    if (filters.model) wanted.model = filters.model.trim();
    query = query.contains("fitments", JSON.stringify([wanted]));
  }
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
 * per locale and needs nothing but the slug. Out-of-stock products get no
 * prebuilt page; if one is restocked its page is rendered on demand. */
export const getAllProductSlugs = cache(async (): Promise<string[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("products").select("slug").gt("stock", 0);
  return (data ?? []).map((row) => row.slug);
});

export type ProductFilters = {
  make?: string;
  model?: string;
  brand?: BrandSlug;
  /** Narrows the result to these products and nothing else.
   *
   * This is how the category filter works: the ids are looked up from the
   * join table first (see productIdsInCategories) rather than joining it into
   * the query here. A product filed under two subcategories of one category
   * would otherwise come back twice and be counted twice, which breaks both
   * the result list and its page count. An empty array means "nothing
   * matches", which is different from leaving it out. */
  productIds?: string[];
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
    if ((filters.make || filters.model) && !productFits(p.fitments, filters.make, filters.model)) {
      return false;
    }
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.yearFrom !== undefined && p.yearTo < filters.yearFrom) return false;
    if (filters.yearTo !== undefined && p.yearFrom > filters.yearTo) return false;
    if (query) {
      const vehicles = p.fitments.map((f) => `${f.make} ${makeLabel(f.make, locale)} ${f.model}`).join(" ");
      const haystack = `${t(p.name, locale)} ${t(p.description, locale)} ${p.productCode ?? ""} ${p.originCode ?? ""} ${vehicles}`
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function computeCarMakes(products: { fitments: Fitment[] }[]): string[] {
  return Array.from(new Set(products.flatMap((p) => p.fitments.map((f) => f.make)))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export function computeYearBounds(products: Product[]): { min: number; max: number } {
  if (products.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...products.map((p) => p.yearFrom)),
    max: Math.max(...products.map((p) => p.yearTo)),
  };
}

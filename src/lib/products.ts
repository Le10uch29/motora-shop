import { cache } from "react";
import type { Locale } from "@/i18n/locales";
import type { BrandSlug } from "@/lib/brands";
import { createPublicClient } from "@/lib/supabase/public";

export type LocalizedText = Record<Locale, string>;

export type CategoryId = "cars" | "trucks" | "vans";

export type ProductSpec = { label: LocalizedText; value: LocalizedText };

export type Product = {
  id: string;
  slug: string;
  name: LocalizedText;
  category: CategoryId;
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

export const categoryIds: CategoryId[] = ["cars", "trucks", "vans"];

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

export const categoryLabels: Record<CategoryId, LocalizedText> = {
  cars: { ru: "Легковые авто", az: "Yüngül avtomobillər", ka: "მსუბუქი ავტომობილები" },
  trucks: { ru: "Грузовики", az: "Yük maşınları", ka: "სატვირთოები" },
  vans: {
    ru: "Спринтеры / микроавтобусы",
    az: "Sprinterlər / mikroavtobuslar",
    ka: "სპრინტერები / მიკროავტობუსები",
  },
};

type ProductRow = {
  id: string;
  slug: string;
  name: LocalizedText;
  category: CategoryId;
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
  "id, slug, name, category, make, model, year_from, year_to, price, old_price, description, specs, stock, badge, images, origin_code, product_code, is_popular, brands(slug)";

function mapRow(row: ProductRow): Product {
  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
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

export type CartProductSummary = Pick<Product, "id" | "slug" | "name" | "category" | "price" | "stock">;

/** Just the columns the cart view renders (name, price, stock, category —
 * for the placeholder image) instead of every product's full row. The cart
 * itself lives in the browser's localStorage, so the server can't know in
 * advance which product ids to filter for — this still has to fetch every
 * product, but a much lighter row: no description, specs, images, or badge. */
export const getProductsForCart = cache(async (): Promise<CartProductSummary[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("products").select("id, slug, name, category, price, stock");
  return (data ?? []) as CartProductSummary[];
});

/** Just the three columns the header's search-filter dropdown needs (make,
 * model, price) — used instead of {@link getAllProducts} on pages that don't
 * otherwise render the full catalog, so Header doesn't drag in every
 * product's images/specs/description in three languages just to compute a
 * make/model list and a price range. */
export const getProductFilterMeta = cache(async (): Promise<{ make: string; model: string; price: number }[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("products").select("make, model, price");
  return (data ?? []).map((row) => ({ make: row.make, model: row.model ?? "", price: Number(row.price) }));
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

export type ProductFilters = {
  category?: CategoryId;
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
    if (filters.category && p.category !== filters.category) return false;
    if (filters.make && p.make !== filters.make) return false;
    if (filters.model && p.model !== filters.model) return false;
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.priceMin !== undefined && p.price < filters.priceMin) return false;
    if (filters.priceMax !== undefined && p.price > filters.priceMax) return false;
    if (filters.yearFrom !== undefined && p.yearTo < filters.yearFrom) return false;
    if (filters.yearTo !== undefined && p.yearFrom > filters.yearTo) return false;
    if (query) {
      const haystack = `${t(p.name, locale)} ${t(p.description, locale)}`.toLowerCase();
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

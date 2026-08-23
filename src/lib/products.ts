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
  brands: { slug: string } | { slug: string }[] | null;
};

const SELECT_COLUMNS =
  "id, slug, name, category, make, model, year_from, year_to, price, old_price, description, specs, stock, badge, images, origin_code, product_code, brands(slug)";

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
  };
}

export async function getAllProducts(): Promise<Product[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as ProductRow[]).map(mapRow);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return data ? mapRow(data as unknown as ProductRow) : undefined;
}

export type ProductFilters = {
  category?: CategoryId;
  make?: string;
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

export function computeCarMakes(products: Product[]): string[] {
  return Array.from(new Set(products.map((p) => p.make))).sort((a, b) => a.localeCompare(b));
}

export function computePriceBounds(products: Product[]): { min: number; max: number } {
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

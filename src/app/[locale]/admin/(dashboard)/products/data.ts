import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/locales";
import type { LocalizedText, ProductSpec } from "@/lib/products";

export const PRODUCTS_PAGE_SIZE = 30;

export type AdminProductRow = {
  id: string;
  slug: string;
  category: string;
  make: string;
  model: string;
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
  category: string;
  make: string;
  model: string | null;
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

export async function getAdminProducts(
  locale: Locale,
  options: { query?: string; page?: number } = {}
): Promise<{ rows: AdminProductRow[]; total: number }> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select(
      "id, slug, category, make, model, brand_id, year_from, year_to, price, old_price, stock, origin_code, product_code, name, description, specs, badge, images, is_popular, brands(name)"
    )
    .order("created_at", { ascending: false });

  let rows: AdminProductRow[] = ((data ?? []) as ProductRow[]).map((p) => {
    const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands;
    return {
      id: p.id,
      slug: p.slug,
      category: p.category,
      make: p.make,
      model: p.model ?? "",
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

  const query = options.query?.trim().toLowerCase();
  if (query) {
    rows = rows.filter((row) =>
      `${row.displayName} ${row.brandName}`.toLowerCase().includes(query)
    );
  }

  const total = rows.length;
  const page = options.page && options.page > 0 ? options.page : 1;
  const start = (page - 1) * PRODUCTS_PAGE_SIZE;

  return { rows: rows.slice(start, start + PRODUCTS_PAGE_SIZE), total };
}

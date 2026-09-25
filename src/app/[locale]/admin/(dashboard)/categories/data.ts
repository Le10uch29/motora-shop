import { createClient } from "@/lib/supabase/server";
import { readAllPages } from "@/lib/supabase/paginate";
import type { Category, CategoryNode } from "@/lib/categories";
import type { LocalizedText } from "@/lib/products";
import type { Locale } from "@/i18n/locales";

/**
 * Category reads for the admin panel.
 *
 * Deliberately separate from lib/categories.ts: the shop only ever sees
 * active categories and in-stock products, while an admin has to see
 * everything — hidden categories, empty ones, and products with nothing left
 * in stock. These also run on the admin's own session rather than the
 * anonymous client, and aren't cached: a list you just edited has to come back
 * changed, not from a 5-minute cache.
 */

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  meta_title: LocalizedText | null;
  meta_description: LocalizedText | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
};

const SELECT_COLUMNS =
  "id, parent_id, slug, name, description, meta_title, meta_description, image_url, sort_order, is_active, is_default";

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isDefault: row.is_default,
  };
}

export async function getAdminCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select(SELECT_COLUMNS)
    .order("sort_order")
    .order("slug");
  return ((data ?? []) as CategoryRow[]).map(mapRow);
}

export async function getAdminCategoryTree(): Promise<CategoryNode[]> {
  const categories = await getAdminCategories();
  return categories
    .filter((c) => c.parentId === null)
    .map((root) => ({ ...root, children: categories.filter((c) => c.parentId === root.id) }));
}

export async function getAdminCategory(id: string): Promise<Category | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
  return data ? mapRow(data as CategoryRow) : undefined;
}

/** Products filed directly under each category id — every product, whatever
 * its stock, since the admin manages those too. */
export async function getAdminCategoryCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const rows = await readAllPages<{ category_id: string }>((from, to) =>
    supabase.from("product_categories").select("category_id").range(from, to)
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  return counts;
}

/** A category's own products plus its subcategories', counted once per
 * product — a product filed under two subcategories of the same category
 * would otherwise be counted twice in the parent's total. */
export function categoryTotal(node: CategoryNode, counts: Record<string, number>): number {
  return [node, ...node.children].reduce((total, c) => total + (counts[c.id] ?? 0), 0);
}

export type CategoryProductRow = {
  id: string;
  slug: string;
  productCode: string;
  originCode: string;
  displayName: string;
  make: string;
  model: string;
  price: number;
  stock: number;
  image: string | null;
};

type ProductRow = {
  id: string;
  slug: string;
  product_code: string | null;
  origin_code: string | null;
  name: LocalizedText;
  make: string;
  model: string | null;
  price: number;
  stock: number;
  images: string[] | null;
};

const PRODUCT_COLUMNS = "id, slug, product_code, origin_code, name, make, model, price, stock, images";

function mapProduct(row: ProductRow, locale: Locale): CategoryProductRow {
  return {
    id: row.id,
    slug: row.slug,
    productCode: row.product_code ?? "",
    originCode: row.origin_code ?? "",
    displayName: row.name?.[locale] ?? row.name?.ru ?? "",
    make: row.make,
    model: row.model ?? "",
    price: row.price,
    stock: row.stock,
    image: row.images?.[0] ?? null,
  };
}

/** The products of one category. Read in two steps — links first, then the
 * products themselves — rather than as one embedded query, so a product
 * linked to this category twice over can't come back twice. */
export async function getCategoryProducts(
  categoryId: string,
  locale: Locale
): Promise<CategoryProductRow[]> {
  const supabase = await createClient();
  const links = await readAllPages<{ product_id: string }>((from, to) =>
    supabase.from("product_categories").select("product_id").eq("category_id", categoryId).range(from, to)
  );
  const ids = Array.from(new Set(links.map((link) => link.product_id)));
  if (ids.length === 0) return [];

  const rows = await readAllPages<ProductRow>((from, to) =>
    supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .in("id", ids)
      .order("created_at", { ascending: false })
      .range(from, to)
  );
  return rows.map((row) => mapProduct(row, locale));
}

/** Products that belong to no category at all — the "Все товары" leftovers an
 * admin still has to file. Counted and listed by asking for every link once
 * and subtracting, which is one query rather than one per product. */
export async function getUncategorizedProducts(locale: Locale): Promise<CategoryProductRow[]> {
  const supabase = await createClient();
  const links = await readAllPages<{ product_id: string }>((from, to) =>
    supabase.from("product_categories").select("product_id").range(from, to)
  );
  const categorized = new Set(links.map((link) => link.product_id));

  const rows = await readAllPages<ProductRow>((from, to) =>
    supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("created_at", { ascending: false })
      .range(from, to)
  );
  return rows.filter((row) => !categorized.has(row.id)).map((row) => mapProduct(row, locale));
}

/** Totals for the header of the categories page: everything in the catalog,
 * and how much of it still has no category. */
export async function getCatalogTotals(): Promise<{ all: number; uncategorized: number }> {
  const supabase = await createClient();
  const [{ count: all }, links] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    readAllPages<{ product_id: string }>((from, to) =>
      supabase.from("product_categories").select("product_id").range(from, to)
    ),
  ]);
  const categorized = new Set(links.map((link) => link.product_id)).size;
  return { all: all ?? 0, uncategorized: Math.max(0, (all ?? 0) - categorized) };
}

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { readAllPages } from "@/lib/supabase/paginate";
import { PRODUCTS_CACHE_TAG } from "@/lib/productFilterMeta";
import type { LocalizedText } from "@/lib/products";

/** Cache tag for the category tree and everything derived from it. Admin
 * actions that create/edit/delete a category call updateTag() with it.
 *
 * This module is server-only (next/cache): a client component may import its
 * types, never its functions. */
export const CATEGORIES_CACHE_TAG = "categories";

export type Category = {
  id: string;
  parentId: string | null;
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  metaTitle: LocalizedText | null;
  metaDescription: LocalizedText | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** The technical "Разное" subcategory of its parent — a product given a
   * category but no subcategory lands here. Never shown as a subcategory of
   * its own on the public site; its products count towards the parent. */
  isDefault: boolean;
};

export type CategoryNode = Category & { children: Category[] };

const SELECT_COLUMNS =
  "id, parent_id, slug, name, description, meta_title, meta_description, image_url, sort_order, is_active, is_default";

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

/** Rows come back in one query and are assembled into the tree here rather
 * than fetched per level: the whole table is a few dozen rows. */
const fetchCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("categories")
      .select(SELECT_COLUMNS)
      .order("sort_order")
      .order("slug");
    return ((data ?? []) as CategoryRow[]).map(mapRow);
  },
  ["categories"],
  { tags: [CATEGORIES_CACHE_TAG], revalidate: 300 }
);

function buildTree(categories: Category[], { activeOnly }: { activeOnly: boolean }): CategoryNode[] {
  const usable = activeOnly ? categories.filter((c) => c.isActive) : categories;
  const roots = usable.filter((c) => c.parentId === null);
  return roots.map((root) => ({
    ...root,
    children: usable.filter((c) => c.parentId === root.id),
  }));
}

/** Every category, flat, active and inactive alike — for the admin panel. */
export async function getAllCategories(): Promise<Category[]> {
  return fetchCategories();
}

/** The whole tree, including inactive categories and each category's
 * "Разное" — for the admin panel. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  return buildTree(await fetchCategories(), { activeOnly: false });
}

/** The tree the shop shows: active categories only, and without the technical
 * "Разное" under each of them. Products filed under "Разное" are still part of
 * their parent category — only the subcategory itself is hidden. */
export async function getPublicCategoryTree(): Promise<CategoryNode[]> {
  return buildTree(await fetchCategories(), { activeOnly: true }).map((node) => ({
    ...node,
    children: node.children.filter((child) => !child.isDefault),
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  return (await fetchCategories()).find((category) => category.slug === slug);
}

/** A category's own id plus its children's — what "everything in this
 * category" means when filtering, "Разное" included. A subcategory resolves to
 * just itself. */
export async function categoryIdsWithin(categoryId: string): Promise<string[]> {
  const categories = await fetchCategories();
  return [categoryId, ...categories.filter((c) => c.parentId === categoryId).map((c) => c.id)];
}

/** The "Разное" of a category — where a product goes when it was given a
 * category but no subcategory. Undefined for a category that somehow has
 * none (only possible if it was deleted by hand). */
export async function getDefaultSubcategory(categoryId: string): Promise<Category | undefined> {
  const categories = await fetchCategories();
  return categories.find((c) => c.parentId === categoryId && c.isDefault);
}

/** How many in-stock products are filed directly under each category id.
 *
 * Direct links only — a parent category's own total is its children's counts
 * plus its own, which {@link categoryProductTotal} works out. Out-of-stock
 * products are left out for the same reason they're invisible everywhere else
 * on the site.
 *
 * Tagged with the products tag as well as the categories one, so editing a
 * product's stock or category refreshes the numbers in the sidebar. */
const fetchCategoryProductCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = createPublicClient();
    const rows = await readAllPages<{ category_id: string }>((from, to) =>
      supabase
        .from("product_categories")
        .select("category_id, products!inner(stock)")
        .gt("products.stock", 0)
        .range(from, to)
    );

    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
    return counts;
  },
  ["category-product-counts"],
  { tags: [CATEGORIES_CACHE_TAG, PRODUCTS_CACHE_TAG], revalidate: 300 }
);

export function getCategoryProductCounts(): Promise<Record<string, number>> {
  return fetchCategoryProductCounts();
}

/** Everything in one category: its own products plus every subcategory's.
 *
 * A product in two subcategories of the same category is counted once — the
 * number under "Ходовая часть" has to match what its page actually lists. */
export function categoryProductTotal(
  node: CategoryNode,
  counts: Record<string, number>
): number {
  return [node, ...node.children].reduce((total, c) => total + (counts[c.id] ?? 0), 0);
}

/** The products filed under any of these categories, as ids.
 *
 * Read through the join table rather than by embedding it in the catalog
 * query: a product linked to two of the categories being asked about would
 * otherwise come back twice and be counted twice. */
export async function productIdsInCategories(categoryIds: string[]): Promise<string[]> {
  if (categoryIds.length === 0) return [];
  const supabase = createPublicClient();
  const rows = await readAllPages<{ product_id: string }>((from, to) =>
    supabase
      .from("product_categories")
      .select("product_id")
      .in("category_id", categoryIds)
      .range(from, to)
  );
  return Array.from(new Set(rows.map((row) => row.product_id)));
}

/** The primary category (and its parent) of each of these products — for the
 * admin product list and a product's own page. */
export async function primaryCategoryByProduct(
  productIds: string[]
): Promise<Record<string, { category: Category; parent: Category | null }>> {
  if (productIds.length === 0) return {};
  const supabase = createPublicClient();
  const [categories, rows] = await Promise.all([
    fetchCategories(),
    readAllPages<{ product_id: string; category_id: string }>((from, to) =>
      supabase
        .from("product_categories")
        .select("product_id, category_id")
        .in("product_id", productIds)
        .eq("is_primary", true)
        .range(from, to)
    ),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const result: Record<string, { category: Category; parent: Category | null }> = {};
  for (const row of rows) {
    const category = byId.get(row.category_id);
    if (!category) continue;
    result[row.product_id] = {
      category,
      parent: category.parentId ? byId.get(category.parentId) ?? null : null,
    };
  }
  return result;
}

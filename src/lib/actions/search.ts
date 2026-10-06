"use server";

import { createPublicClient } from "@/lib/supabase/public";
import type { Locale } from "@/i18n/locales";

export type SearchSuggestion = {
  id: string;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  productCode: string | null;
  stock: number;
};

const RESULT_LIMIT = 6;

// PostgREST's .or() filter string breaks on these characters in a raw
// value, so they're stripped before the query string is built.
function sanitizeForFilter(value: string): string {
  return value.replace(/[,()]/g, "");
}

/** Live search-as-you-type suggestions — same match fields as the full
 * catalog search (name in the current locale, product code, origin code,
 * make, model), just capped and lean for a dropdown instead of the whole
 * catalog. Optionally scoped to one brand for BrandSearch. */
export async function searchProductSuggestionsAction(
  locale: Locale,
  query: string,
  brandSlug?: string,
  /** Сколько позиций вернуть. В шапке сайта список короткий — он лишь ведёт в
   * каталог; в админке заказ собирается прямо в нём, и выбирать приходится из
   * большего. Данные те же самые и публичные, так что ограничение здесь —
   * вопрос удобства, а не доступа. */
  limit = RESULT_LIMIT,
  /** Сколько совпадений пропустить — для листания выдачи. В шапке сайта
   * листать нечего (список ведёт в каталог), а в админке заказ собирают
   * прямо из него, и до нужной позиции нужно уметь дойти. */
  offset = 0
): Promise<{ results: SearchSuggestion[]; total: number }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { results: [], total: 0 };

  const supabase = createPublicClient();
  const safe = sanitizeForFilter(trimmed);
  const orFilter = `name->>${locale}.ilike.%${safe}%,product_code.ilike.%${safe}%,origin_code.ilike.%${safe}%,make.ilike.%${safe}%,model.ilike.%${safe}%`;

  // Устойчивый порядок: без него страницы листания пересекаются и одни и те же
  // товары попадают на разные страницы, а другие не попадают никуда.
  const ORDER = { column: "product_code", options: { ascending: true, nullsFirst: false } } as const;

  // Built as two fully separate branches (not one query object mutated by a
  // ternary select string) — supabase-js parses the select string at the
  // type level, and a select string built from a ternary produces a union
  // it can't resolve, even though each branch alone is fine.
  const [{ data, error }, { count }] = brandSlug
    ? await Promise.all([
        supabase
          .from("products")
          .select(
            "id, slug, name, price, old_price, images, product_code, stock, brands!inner(slug)"
          )
          .or(orFilter)
          .eq("brands.slug", brandSlug)
          .gt("stock", 0)
          .order(ORDER.column, ORDER.options)
          .range(offset, offset + limit - 1),
        supabase
          .from("products")
          .select("id, brands!inner(slug)", { count: "exact", head: true })
          .or(orFilter)
          .eq("brands.slug", brandSlug)
          .gt("stock", 0),
      ])
    : await Promise.all([
        supabase
          .from("products")
          .select("id, slug, name, price, old_price, images, product_code, stock")
          .or(orFilter)
          .gt("stock", 0)
          .order(ORDER.column, ORDER.options)
          .range(offset, offset + limit - 1),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .or(orFilter)
          .gt("stock", 0),
      ]);
  if (error || !data) return { results: [], total: 0 };

  const results: SearchSuggestion[] = data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name?.[locale] ?? row.name?.ru ?? "",
    price: Number(row.price),
    oldPrice: row.old_price != null ? Number(row.old_price) : null,
    image: row.images?.[0] ?? null,
    productCode: row.product_code ?? null,
    stock: row.stock,
  }));

  return { results, total: count ?? results.length };
}

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { fitmentsOf, type Fitment } from "@/lib/fitments";

/** Cache tag for anything derived from the product catalog as a whole.
 * Product create/update/delete/import call revalidateTag() with it, so an
 * admin's change shows up in the header immediately instead of waiting out
 * the revalidate window below. */
export const PRODUCTS_CACHE_TAG = "products";

export type ProductFilterMeta = { fitments: Fitment[]; price: number };

/** Vehicles (make/model) and price of every product — the header's search-filter dropdown
 * builds its make list, model list and price range from it on every page.
 *
 * Cached across requests, not just within one: the query itself is small per
 * row but there are hundreds of them, and it was costing the better part of a
 * second on every single page render. The catalog only changes when an admin
 * edits it, and those paths revalidate this tag, so the cached copy is the
 * fresh one in practice; the time-based window is only a backstop for changes
 * made outside the admin panel (straight in the database, say).
 *
 * This lives in its own module rather than in lib/products.ts because
 * next/cache is server-only, and lib/products.ts is imported by client
 * components too. */
const fetchProductFilterMeta = unstable_cache(
  async (): Promise<ProductFilterMeta[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select("make, model, fitments, year_from, year_to, price");
    return (data ?? []).map((row) => ({
      fitments: fitmentsOf({ ...row, yearFrom: row.year_from, yearTo: row.year_to }),
      price: Number(row.price),
    }));
  },
  ["product-filter-meta"],
  { tags: [PRODUCTS_CACHE_TAG], revalidate: 300 }
);

export function getProductFilterMeta(): Promise<ProductFilterMeta[]> {
  return fetchProductFilterMeta();
}

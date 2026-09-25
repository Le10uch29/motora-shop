import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { getAdminCategoryTree, getAdminCategoryCounts, categoryTotal, getCatalogTotals } from "./data";
import CategoriesListClient, { type CategoryListItem } from "./CategoriesListClient";
import { categoryOptions } from "./options";

export default async function AdminCategoriesPage({
  params,
}: PageProps<"/[locale]/admin/categories">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Categories shape the storefront, so they're admin-only like brands — a
  // seller may look at products but not restructure the catalog.
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const [tree, counts, totals] = await Promise.all([
    getAdminCategoryTree(),
    getAdminCategoryCounts(),
    getCatalogTotals(),
  ]);

  const items: CategoryListItem[] = tree.map((node) => ({
    category: node,
    productCount: categoryTotal(node, counts),
    subcategoryCount: node.children.length,
  }));

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      {/* "Все товары" isn't a category — it's the whole catalog, and the
          products with no category of their own are the ones an admin still
          has to file. Both are counts, not rows in the table. */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-zinc-100 px-4 py-1.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {dict.admin.allProductsLabel} — {totals.all}
        </span>
        <Link
          href={`/${locale}/admin/categories/uncategorized`}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            totals.uncategorized > 0
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-500"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800"
          }`}
        >
          {dict.admin.uncategorizedLabel} — {totals.uncategorized}
        </Link>
      </div>

      <CategoriesListClient
        locale={locale}
        dict={dict.admin}
        parent={null}
        items={items}
        allCategories={categoryOptions(tree, locale)}
      />
    </main>
  );
}

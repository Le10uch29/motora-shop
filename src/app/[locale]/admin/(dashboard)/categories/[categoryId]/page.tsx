import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminCategory,
  getAdminCategoryTree,
  getAdminCategoryCounts,
  categoryTotal,
} from "../data";
import CategoriesListClient, { type CategoryListItem } from "../CategoriesListClient";
import { categoryOptions } from "../options";

export default async function AdminCategoryPage({
  params,
}: PageProps<"/[locale]/admin/categories/[categoryId]">) {
  const { locale, categoryId } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const [category, tree, counts] = await Promise.all([
    getAdminCategory(categoryId),
    getAdminCategoryTree(),
    getAdminCategoryCounts(),
  ]);
  if (!category) notFound();

  const node = tree.find((n) => n.id === categoryId);
  // A subcategory opened by its own id has no children of its own; its
  // products live one level down, at .../[categoryId]/[subcategoryId].
  if (!node) notFound();

  const items: CategoryListItem[] = node.children.map((child) => ({
    category: child,
    productCount: counts[child.id] ?? 0,
    subcategoryCount: 0,
  }));

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/${locale}/admin/categories`} className="text-orange-600 hover:underline">
          {dict.admin.categoriesTitle}
        </Link>
        <span className="text-zinc-400">/</span>
        <span className="text-zinc-600 dark:text-zinc-300">{category.name[locale] || category.name.ru}</span>
        <span className="text-zinc-400">·</span>
        <span className="text-zinc-500">
          {dict.admin.categoryProductsLabel} {categoryTotal(node, counts)}
        </span>
      </div>

      <CategoriesListClient
        locale={locale}
        dict={dict.admin}
        parent={category}
        items={items}
        allCategories={categoryOptions(tree, locale)}
      />
    </main>
  );
}

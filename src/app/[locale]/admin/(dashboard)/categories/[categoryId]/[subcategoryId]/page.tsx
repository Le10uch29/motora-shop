import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { getAdminCategory, getAdminCategoryTree, getCategoryProducts } from "../../data";
import CategoryProductsClient from "../../CategoryProductsClient";
import { categoryOptions } from "../../options";

export default async function AdminSubcategoryPage({
  params,
}: PageProps<"/[locale]/admin/categories/[categoryId]/[subcategoryId]">) {
  const { locale, categoryId, subcategoryId } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const [category, subcategory, tree, products] = await Promise.all([
    getAdminCategory(categoryId),
    getAdminCategory(subcategoryId),
    getAdminCategoryTree(),
    getCategoryProducts(subcategoryId, locale),
  ]);
  if (!category || !subcategory) notFound();
  // Guards against a hand-typed URL pairing a subcategory with the wrong
  // parent, which would show the right products under the wrong heading.
  if (subcategory.parentId !== category.id) notFound();

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/${locale}/admin/categories`} className="text-orange-600 hover:underline">
          {dict.admin.categoriesTitle}
        </Link>
        <span className="text-zinc-400">/</span>
        <Link href={`/${locale}/admin/categories/${category.id}`} className="text-orange-600 hover:underline">
          {category.name[locale] || category.name.ru}
        </Link>
        <span className="text-zinc-400">/</span>
        <span className="text-zinc-600 dark:text-zinc-300">
          {subcategory.name[locale] || subcategory.name.ru}
        </span>
      </div>

      <CategoryProductsClient
        locale={locale}
        dict={dict.admin}
        categoryId={subcategory.id}
        products={products}
        categoryOptions={categoryOptions(tree, locale)}
      />
    </main>
  );
}

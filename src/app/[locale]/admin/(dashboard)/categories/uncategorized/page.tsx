import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { getAdminCategoryTree, getUncategorizedProducts } from "../data";
import UncategorizedClient from "./UncategorizedClient";
import { categoryOptions } from "../options";

export default async function AdminUncategorizedPage({
  params,
}: PageProps<"/[locale]/admin/categories/uncategorized">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const [products, tree] = await Promise.all([
    getUncategorizedProducts(locale),
    getAdminCategoryTree(),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/${locale}/admin/categories`} className="text-orange-600 hover:underline">
          {dict.admin.categoriesTitle}
        </Link>
        <span className="text-zinc-400">/</span>
        <span className="text-zinc-600 dark:text-zinc-300">{dict.admin.uncategorizedLabel}</span>
      </div>

      <UncategorizedClient
        locale={locale}
        dict={dict.admin}
        products={products}
        categoryOptions={categoryOptions(tree, locale)}
      />
    </main>
  );
}

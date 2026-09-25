import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/locales";
import { getCategoryBySlug } from "@/lib/categories";
import CatalogView from "../../../CatalogView";

/** One subcategory: only its own products. */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/catalog/category/[categorySlug]/[subcategorySlug]">): Promise<Metadata> {
  const { locale, subcategorySlug } = await params;
  if (!isLocale(locale)) return {};
  const subcategory = await getCategoryBySlug(subcategorySlug);
  if (!subcategory) return {};
  const title = subcategory.metaTitle?.[locale] || subcategory.name[locale] || subcategory.name.ru;
  return {
    title: `${title} — Araz Motors`,
    description:
      subcategory.metaDescription?.[locale] || subcategory.description?.[locale] || undefined,
  };
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/catalog/category/[categorySlug]/[subcategorySlug]">) {
  const { locale, categorySlug, subcategorySlug } = await params;
  if (!isLocale(locale)) notFound();

  const [category, subcategory] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getCategoryBySlug(subcategorySlug),
  ]);

  // The pair has to be real and belong together: a hand-typed URL matching a
  // subcategory with the wrong parent would otherwise show the right products
  // under the wrong heading. "Разное" has no page of its own — its products
  // are reached through its category.
  if (!category || !subcategory) notFound();
  if (!category.isActive || !subcategory.isActive) notFound();
  if (subcategory.parentId !== category.id || subcategory.isDefault) notFound();

  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      category={category}
      subcategory={subcategory}
    />
  );
}

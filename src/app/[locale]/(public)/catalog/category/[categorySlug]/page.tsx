import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/locales";
import { getCategoryBySlug } from "@/lib/categories";
import CatalogView from "../../CatalogView";

/**
 * One category: everything filed under it, its subcategories and "Разное"
 * included.
 *
 * The URL keeps the `category` segment (/catalog/category/chassis) because a
 * product lives at /catalog/{slug} — a flat /catalog/chassis would collide
 * with a product whose slug happened to be "chassis".
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/catalog/category/[categorySlug]">): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  if (!isLocale(locale)) return {};
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return {};
  const title = category.metaTitle?.[locale] || category.name[locale] || category.name.ru;
  return {
    title: `${title} — Araz Motors`,
    description: category.metaDescription?.[locale] || category.description?.[locale] || undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/catalog/category/[categorySlug]">) {
  const { locale, categorySlug } = await params;
  if (!isLocale(locale)) notFound();

  const category = await getCategoryBySlug(categorySlug);
  // A hidden category is a 404 on the storefront, like a product out of stock.
  if (!category || !category.isActive || category.parentId !== null) notFound();

  return <CatalogView locale={locale} searchParams={await searchParams} category={category} />;
}

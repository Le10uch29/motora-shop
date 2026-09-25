import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import CatalogView from "./CatalogView";

/** The whole shop: "Все товары" — every product, no category filter. */
export default async function CatalogPage({
  params,
  searchParams,
}: PageProps<"/[locale]/catalog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <CatalogView locale={locale} searchParams={await searchParams} />;
}

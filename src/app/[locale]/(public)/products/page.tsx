import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/locales";

/** Пункта «Продукты» в меню больше нет — это был тот же каталог. Адрес
 * оставлен, чтобы старые закладки и ссылки вели в «Весь каталог», а не на 404. */
export default async function ProductsPage({ params }: PageProps<"/[locale]/products">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/catalog`);
}

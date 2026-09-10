import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";

export default async function ProductsPage({
  params,
}: PageProps<"/[locale]/products">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-4 px-2 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.header.products}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">{dict.pages.comingSoon}</p>
    </main>
  );
}

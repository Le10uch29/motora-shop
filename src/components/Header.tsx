import Link from "next/link";
import { Suspense } from "react";
import { categoryIds, categoryLabels, t } from "@/lib/products";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import CartIndicator from "@/components/CartIndicator";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Header({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link
          href={`/${locale}`}
          className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          MOTORA
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 md:flex">
          <Link href={`/${locale}/catalog`} className="transition-colors hover:text-orange-600">
            {dict.header.allCatalog}
          </Link>
          {categoryIds.map((category) => (
            <Link
              key={category}
              href={`/${locale}/catalog?category=${category}`}
              className="transition-colors hover:text-orange-600"
            >
              {t(categoryLabels[category], locale)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="h-8 w-[104px]" />}>
            <LanguageSwitcher locale={locale} />
          </Suspense>
          <CartIndicator locale={locale} ariaLabel={dict.header.cartAriaLabel} />
        </div>
      </div>
    </header>
  );
}

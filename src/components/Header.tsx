import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import { carMakes } from "@/lib/products";
import { catalogBrands } from "@/lib/brands";
import CartIndicator from "@/components/CartIndicator";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HeaderSearch from "@/components/HeaderSearch";
import MobileMenu from "@/components/MobileMenu";

export default function Header({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const navLinks = [
    { href: `/${locale}/catalog`, label: dict.header.allCatalog },
    { href: `/${locale}/promotions`, label: dict.header.promotions },
    { href: `/${locale}/about`, label: dict.header.about },
    { href: `/${locale}/brands`, label: dict.header.brands },
    { href: `/${locale}/products`, label: dict.header.products },
    { href: `/${locale}/contacts`, label: dict.header.contacts },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
      <div className="relative mx-auto flex max-w-6xl items-center gap-2 px-4 py-4 sm:gap-4 sm:px-6 lg:gap-6">
        <Link
          href={`/${locale}`}
          className="shrink-0 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <span className="sm:hidden">ARAZ</span>
          <span className="hidden sm:inline">ARAZ MOTORS</span>
        </Link>
        <div className="min-w-0 flex-1 lg:max-w-xs">
          <Suspense fallback={<div className="h-9 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" />}>
            <HeaderSearch
              locale={locale}
              dict={dict.search}
              carMakes={carMakes}
              brands={catalogBrands}
            />
          </Suspense>
        </div>
        <nav className="hidden shrink-0 items-center gap-5 text-sm font-medium text-zinc-600 dark:text-zinc-400 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-orange-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden lg:block">
            <Suspense fallback={<div className="h-8 w-[104px]" />}>
              <LanguageSwitcher locale={locale} />
            </Suspense>
          </div>
          <CartIndicator locale={locale} ariaLabel={dict.header.cartAriaLabel} />
          <MobileMenu
            locale={locale}
            navLinks={navLinks}
            menuAriaLabel={dict.header.menuAriaLabel}
            closeMenuAriaLabel={dict.header.closeMenuAriaLabel}
          />
        </div>
      </div>
    </header>
  );
}

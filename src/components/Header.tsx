import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import { getAllProducts, computeCarMakes, computePriceBounds, localizedMakes } from "@/lib/products";
import { getCatalogBrands } from "@/lib/brands";
import { getCurrentStaff } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import CartIndicator from "@/components/CartIndicator";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HeaderSearch from "@/components/HeaderSearch";
import MobileMenu from "@/components/MobileMenu";

export default async function Header({
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

  const staff = await getCurrentStaff();
  const isLoggedIn = Boolean(staff);
  const catalogBrands = await getCatalogBrands();
  const allProducts = await getAllProducts();
  const carMakes = computeCarMakes(allProducts);
  const priceBounds = computePriceBounds(allProducts);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={`/${locale}`}
            className="shrink-0 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            <span className="sm:hidden">ARAZ</span>
            <span className="hidden sm:inline">ARAZ MOTORS</span>
          </Link>
          <Suspense fallback={<div className="h-9 w-36 rounded-full bg-zinc-100 dark:bg-zinc-800 sm:w-56" />}>
            <HeaderSearch
              locale={locale}
              dict={dict.search}
              carMakes={localizedMakes(carMakes, locale)}
              brands={catalogBrands}
              maxPrice={priceBounds.max}
            />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden lg:block">
            <Suspense fallback={<div className="h-8 w-[104px]" />}>
              <LanguageSwitcher locale={locale} />
            </Suspense>
          </div>
          {isLoggedIn ? (
            <form action={signOutAction} className="hidden lg:block">
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                aria-label={dict.auth.logoutLabel}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-200"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </form>
          ) : (
            <Link
              href={`/${locale}/login`}
              aria-label={dict.auth.navLabel}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-200 lg:flex"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-5 w-5"
              >
                <circle cx="12" cy="8" r="3.2" />
                <path strokeLinecap="round" d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
              </svg>
            </Link>
          )}
          <CartIndicator locale={locale} ariaLabel={dict.header.cartAriaLabel} />
          <MobileMenu
            locale={locale}
            navLinks={navLinks}
            menuAriaLabel={dict.header.menuAriaLabel}
            closeMenuAriaLabel={dict.header.closeMenuAriaLabel}
            loginHref={`/${locale}/login`}
            loginLabel={dict.auth.navLabel}
            isLoggedIn={isLoggedIn}
            logoutLabel={dict.auth.logoutLabel}
          />
        </div>
      </div>
    </header>
  );
}

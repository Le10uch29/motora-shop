import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import {
  computeCarMakes,
  computeModelsByMake,
  computePriceBounds,
  localizedMakes,
} from "@/lib/products";
import { getProductFilterMeta } from "@/lib/productFilterMeta";
import { getCatalogBrands } from "@/lib/brands";
import { getCurrentStaff, getCurrentCustomer } from "@/lib/auth";
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

  // Independent fetches run in parallel — staff/customer depend on each
  // other (only check customer if not staff), but brands and the filter
  // metadata don't depend on anything here.
  const [staff, catalogBrands, productMeta] = await Promise.all([
    getCurrentStaff(),
    getCatalogBrands(),
    getProductFilterMeta(),
  ]);
  const customer = staff ? null : await getCurrentCustomer();
  const isLoggedIn = Boolean(staff) || Boolean(customer);
  const carMakes = computeCarMakes(productMeta);
  const priceBounds = computePriceBounds(productMeta);
  const modelsByMake = computeModelsByMake(productMeta);

  return (
    <header className="flame-header sticky top-0 z-30 border-b border-zinc-200 shadow-md shadow-black/5 backdrop-blur dark:border-zinc-800">
      <div className="relative mx-auto flex max-w-[120rem] items-center gap-3 px-4 py-4 sm:gap-4 sm:px-2">
        <Link
          href={`/${locale}`}
          className="shrink-0 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <span className="sm:hidden">
            ARAZ<span>-2026</span>
          </span>
          <span className="hidden sm:inline">
            ARAZ MOTORS<span>-2026</span>
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<div className="h-9 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" />}>
            <HeaderSearch
              locale={locale}
              dict={dict.search}
              carMakes={localizedMakes(carMakes, locale)}
              modelsByMake={modelsByMake}
              brands={catalogBrands}
              maxPrice={priceBounds.max}
            />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden lg:block">
            <Suspense fallback={<div className="h-8 w-[104px]" />}>
              <LanguageSwitcher locale={locale} ariaLabel={dict.header.languageSwitcherAriaLabel} />
            </Suspense>
          </div>
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
            accountHref={customer ? `/${locale}/account` : undefined}
            accountLabel={dict.admin.myAccountTitle}
            adminPanelHref={staff ? `/${locale}/admin` : undefined}
            adminPanelLabel={dict.admin.dashboardTitle}
            themeToggleAriaLabel={dict.header.themeToggleAriaLabel}
            languageSwitcherAriaLabel={dict.header.languageSwitcherAriaLabel}
          />
        </div>
      </div>
    </header>
  );
}

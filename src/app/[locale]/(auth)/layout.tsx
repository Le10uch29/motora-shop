import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import SiteLogo from "@/components/SiteLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

/**
 * Страница входа покупателя — единственная страница витрины, которую видит
 * гость. Каталог закрыт, поэтому шапки магазина (поиск, фильтры марок и
 * моделей, бренды) здесь нет: только логотип, язык, тема, форма и подвал с
 * контактами. Отдельная группа маршрутов, а не условие в (public)/layout, —
 * так витринная шапка с запросами к каталогу на этой странице не рендерится
 * вовсе.
 */
export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <>
      <header className="flame-header border-b border-zinc-200 shadow-md shadow-black/5 dark:border-zinc-800">
        <div className="mx-auto flex max-w-[120rem] items-center justify-between gap-3 px-4 py-4 sm:px-2">
          <Link href={`/${locale}/login`} aria-label="ARAZ-MOTORS 2026">
            <SiteLogo className="h-[3.125rem] sm:h-[3.7rem]" sizes="(min-width: 640px) 120px, 102px" />
          </Link>
          <div className="flex items-center gap-3">
            <Suspense fallback={<div className="h-8 w-[104px]" />}>
              <LanguageSwitcher locale={locale} ariaLabel={dict.header.languageSwitcherAriaLabel} />
            </Suspense>
            <ThemeToggle ariaLabel={dict.header.themeToggleAriaLabel} />
          </div>
        </div>
      </header>
      {children}
      <Footer locale={locale} dict={dict} />
    </>
  );
}

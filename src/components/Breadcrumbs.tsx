import Link from "next/link";
import { Fragment } from "react";
import BackButton from "@/components/BackButton";
import type { Locale } from "@/i18n/locales";

export type Crumb = { label: string; href?: string };

/**
 * Путь до текущей страницы плюс кнопка «Назад» — одной строкой в начале
 * каждой страницы магазина, кроме главной.
 *
 * «Главная» подставляется сама, дальше идут крошки, которые передала
 * страница. Последняя крошка — текущее место, она без ссылки: подкатегория
 * показывается как «Электрика / Датчики», и из неё видно, куда подняться.
 */
export default function Breadcrumbs({
  locale,
  items,
  labels,
}: {
  locale: Locale;
  items: Crumb[];
  labels: { home: string; back: string };
}) {
  const crumbs: Crumb[] = [{ label: labels.home, href: `/${locale}` }, ...items];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <BackButton label={labels.back} />

      <nav aria-label={labels.home} className="min-w-0 text-sm text-zinc-500">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <span className="px-1.5 text-zinc-300 dark:text-zinc-600">/</span>}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="transition-colors hover:text-orange-600">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-zinc-700 dark:text-zinc-300">{crumb.label}</span>
              )}
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}

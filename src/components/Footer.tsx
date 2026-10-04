import Link from "next/link";
import { SHOP_CONTACTS, SITE_AUTHOR, emailHref, phoneHref } from "@/lib/contacts";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";

/**
 * Подвал витрины: логотип, контакты и подпись автора.
 *
 * Контакты берутся из того же {@link SHOP_CONTACTS}, что и страница «О нас» —
 * номер, записанный в двух местах, рано или поздно разъезжается. Переводятся
 * только подписи к ним.
 *
 * Админка не использует этот компонент: у неё свой layout, и подвал с
 * контактами магазина там не нужен.
 */
export default function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const contacts: { label: string; value: string; href?: string }[] = [
    { label: dict.pages.contactsPhone, value: SHOP_CONTACTS.phone, href: phoneHref },
    { label: dict.pages.contactsEmail, value: SHOP_CONTACTS.email, href: emailHref },
    { label: dict.pages.contactsOrganizationId, value: SHOP_CONTACTS.organizationIdNumber },
  ];

  return (
    // mt-auto прижимает подвал к низу на короткой странице: body — колонка во
    // всю высоту, а main занимает свободное место.
    //
    // Фон на ступень контрастнее страницы в обе стороны (светлая тема —
    // темнее, тёмная — светлее): на одинаковом фоне подвал сливался с
    // контентом и не читался как отдельная часть страницы.
    <footer className="mt-auto border-t border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mx-auto flex w-full max-w-[120rem] flex-col gap-8 px-4 py-10 sm:px-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link
            href={`/${locale}`}
            className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            ARAZ MOTORS<span>-2026</span>
          </Link>
          <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{dict.home.heroTitle}</p>
        </div>

        {/* Контакты — ниже логотипа, по левому краю и строго друг под другом. */}
        <dl className="flex flex-col gap-3 text-sm">
          {contacts.map(({ label, value, href }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {label}
              </dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                {href ? (
                  <a href={href} className="transition-colors hover:text-orange-600">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col items-center gap-1 border-t border-zinc-300 pt-6 dark:border-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            © {new Date().getFullYear()} {dict.home.brand}
          </p>
          <a
            href={SITE_AUTHOR.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-zinc-500 transition-colors hover:text-orange-600 dark:text-zinc-400"
          >
            {SITE_AUTHOR.label}
          </a>
        </div>
      </div>
    </footer>
  );
}

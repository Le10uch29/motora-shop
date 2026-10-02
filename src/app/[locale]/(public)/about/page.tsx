import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SHOP_CONTACTS, emailHref, phoneHref } from "@/lib/contacts";

export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-4 px-2 py-10">
      <Breadcrumbs
        locale={locale}
        labels={{ home: dict.catalog.breadcrumbHome, back: dict.catalog.backButton }}
        items={[{ label: dict.header.about }]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.header.about}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">{dict.pages.comingSoon}</p>

      <section className="flex max-w-xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {dict.pages.contactsTitle}
        </h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              {dict.pages.contactsPhone}
            </dt>
            <dd>
              <a
                href={phoneHref}
                className="font-medium text-zinc-900 transition-colors hover:text-orange-600 dark:text-zinc-50"
              >
                {SHOP_CONTACTS.phone}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              {dict.pages.contactsEmail}
            </dt>
            <dd>
              <a
                href={emailHref}
                className="font-medium text-zinc-900 transition-colors hover:text-orange-600 dark:text-zinc-50"
              >
                {SHOP_CONTACTS.email}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              {dict.pages.contactsOrganizationId}
            </dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">
              {SHOP_CONTACTS.organizationIdNumber}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

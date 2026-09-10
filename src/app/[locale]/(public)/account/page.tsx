import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireCustomer } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import PhotoForm from "./PhotoForm";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const customer = await requireCustomer(locale);
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-3 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.admin.myAccountTitle}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {customer.firstName} {customer.lastName} · {customer.organizationName}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.admin.photoLabel}</h2>
        <PhotoForm locale={locale} dict={dict.admin} photoUrl={customer.photoUrl} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.admin.changePasswordTitle}</h2>
        <ChangePasswordForm dict={dict.admin} />
      </section>
    </main>
  );
}

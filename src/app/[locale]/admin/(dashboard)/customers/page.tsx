import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import AdminSearchBox from "@/components/admin/AdminSearchBox";

export default async function CustomersPage({
  params,
}: PageProps<"/[locale]/admin/customers">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.admin.customersTitle}
      </h1>
      <form className="flex items-center gap-2">
        <AdminSearchBox placeholder={dict.admin.searchPlaceholder} />
      </form>
      <p className="text-zinc-500">{dict.admin.customersComingSoon}</p>
    </main>
  );
}

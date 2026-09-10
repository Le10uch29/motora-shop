import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/admin/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaff(locale);
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-6 px-2 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.admin.changePasswordTitle}
      </h1>
      <ChangePasswordForm dict={dict.admin} />
    </main>
  );
}

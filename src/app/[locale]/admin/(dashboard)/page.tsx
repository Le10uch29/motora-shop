import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";

export default async function AdminDashboardPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-2 px-3 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.admin.dashboardTitle}
      </h1>
      <p className="text-zinc-500">
        {staff.firstName} {staff.lastName} · {staff.role === "admin" ? dict.admin.roleAdmin : dict.admin.roleSeller}
      </p>
    </main>
  );
}

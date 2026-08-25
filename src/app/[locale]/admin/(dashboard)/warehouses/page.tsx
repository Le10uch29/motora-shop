import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { getWarehouses } from "./data";
import WarehousesListClient from "./WarehousesListClient";

export default async function AdminWarehousesPage({
  params,
}: PageProps<"/[locale]/admin/warehouses">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);

  const warehouses = await getWarehouses();

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10">
      <WarehousesListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={staff.role === "admin"}
        warehouses={warehouses}
      />
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { getWarehouseById, getWarehouseStock, getProductOptions } from "../data";
import WarehouseStockListClient from "./WarehouseStockListClient";

export default async function WarehouseDetailPage({
  params,
}: PageProps<"/[locale]/admin/warehouses/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  // Warehouses isn't part of a seller's permitted scope — admin-only.
  const staff = await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const warehouse = await getWarehouseById(id);
  if (!warehouse) notFound();

  const [stock, products] = await Promise.all([
    getWarehouseStock(id, locale),
    getProductOptions(locale),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href={`/${locale}/admin/warehouses`} className="text-sm text-zinc-500 hover:text-orange-600">
        {dict.admin.backToWarehouses}
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {warehouse.name}
        </h1>
        <p className="text-zinc-500">{warehouse.address || "—"}</p>
      </div>

      <WarehouseStockListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={staff.role === "admin"}
        warehouseId={id}
        stock={stock}
        products={products}
      />
    </main>
  );
}

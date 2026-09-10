import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { t } from "@/lib/products";
import { formatGel } from "@/lib/currency";
import { actionLabel } from "../../logs/labels";

export default async function ProductDetailPage({
  params,
}: PageProps<"/[locale]/admin/products/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaff(locale);
  const dict = await getDictionary(locale);

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("products")
    .select(
      "id, make, model, year_from, year_to, price, old_price, stock, origin_code, product_code, name, description, brands(name)"
    )
    .eq("id", id)
    .single();

  if (!row) notFound();

  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;

  const { data: entries } = await admin
    .from("logs")
    .select("id, action, staff_name, entity_label, created_at")
    .eq("entity_type", "product")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const createdEntry = (entries ?? []).find((entry) => entry.action === "create");
  const lastUpdatedEntry = (entries ?? []).find((entry) => entry.action === "update");

  const fields: [string, string][] = [
    [dict.admin.productsColName, t(row.name, locale)],
    [dict.admin.productsColBrand, brand?.name ?? "—"],
    [dict.admin.productMakeLabel, row.make],
    [dict.admin.productModelLabel, row.model ?? "—"],
    [dict.admin.productYearFromLabel, String(row.year_from)],
    [dict.admin.productYearToLabel, String(row.year_to)],
    [dict.admin.productsColPrice, formatGel(row.price, locale)],
    [dict.admin.productsColStock, String(row.stock)],
    [dict.admin.productOriginCodeLabel, row.origin_code ?? "—"],
    [dict.admin.productProductCodeLabel, row.product_code ?? "—"],
    [dict.admin.tableId, row.id],
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-2 py-10">
      <Link href={`/${locale}/admin/products`} className="text-sm text-zinc-500 hover:text-orange-600">
        ← {dict.admin.productsAdminTitle}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.admin.productDetailsTitle}
      </h1>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-zinc-200 p-6 sm:grid-cols-2 dark:border-zinc-800">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{value}</dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-zinc-200 p-6 sm:grid-cols-2 dark:border-zinc-800">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{dict.admin.productAddedByLabel}</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {createdEntry ? `${createdEntry.staff_name} · ${new Date(createdEntry.created_at).toLocaleString(locale)}` : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{dict.admin.productLastEditedByLabel}</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {lastUpdatedEntry
              ? `${lastUpdatedEntry.staff_name} · ${new Date(lastUpdatedEntry.created_at).toLocaleString(locale)}`
              : "—"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.admin.historyTitle}</h2>
        {entries && entries.length > 0 ? (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {entry.staff_name} · {actionLabel(dict.admin, entry.action)}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(entry.created_at).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{dict.admin.productHistoryEmpty}</p>
        )}
      </div>
    </main>
  );
}

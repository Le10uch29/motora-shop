import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { single } from "@/lib/searchParams";
import Pagination from "@/components/admin/Pagination";
import { getBrandOptions } from "../data";
import type { ImportRunRow } from "../productTypes";
import ImportRunsClient from "./ImportRunsClient";

const RUNS_PAGE_SIZE = 20;

/** «История импортов» — каждый Excel-импорт с возможностью отката, переноса
 * на другой бренд и просмотра его товаров. Только админ. */
export default async function ImportHistoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/products/imports">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const page = Math.max(1, Number(single(sp.page)) || 1);
  const from = (page - 1) * RUNS_PAGE_SIZE;

  // История пишется серверным ключом и читается так же — после проверки роли.
  const admin = createAdminClient();
  const [{ data, count, error }, brands] = await Promise.all([
    admin
      .from("import_runs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + RUNS_PAGE_SIZE - 1),
    getBrandOptions(),
  ]);

  const runs: ImportRunRow[] = (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    staffName: row.staff_name,
    fileName: row.file_name,
    brandName: row.brand_name,
    warehouseName: row.warehouse_name,
    created: row.created_count,
    updated: row.updated_count,
    unchanged: row.unchanged_count,
    skipped: row.skipped_count,
    conflicts: row.conflicts_count,
    stock: row.stock_count,
    status: row.status,
    rolledBackAt: row.rolled_back_at,
    rolledBackBy: row.rolled_back_by,
    movedToBrandName: row.moved_to_brand_name,
    movedAt: row.moved_at,
  }));

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <Link href={`/${locale}/admin/products`} className="text-sm text-zinc-500 hover:text-orange-600">
        ← {dict.admin.productsAdminTitle}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.admin.importHistoryTitle}
        </h1>
        <p className="max-w-3xl text-sm text-zinc-500">{dict.admin.importHistoryHint}</p>
      </div>

      {/* Таблиц истории ещё нет — SQL не выполнен. */}
      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          {dict.admin.importHistoryNotReady}
        </p>
      ) : (
        <ImportRunsClient locale={locale} dict={dict.admin} runs={runs} brands={brands} />
      )}

      <Pagination
        basePath={`/${locale}/admin/products/imports`}
        currentPage={page}
        total={count ?? 0}
        pageSize={RUNS_PAGE_SIZE}
        searchParams={{}}
      />
    </main>
  );
}

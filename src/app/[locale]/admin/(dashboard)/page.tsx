import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import { formatGel } from "@/lib/currency";
import {
  DEFAULT_DASHBOARD_PERIOD,
  DASHBOARD_PERIODS,
  LOW_STOCK_THRESHOLD,
  SALES_METRICS,
  isDashboardPeriod,
  isSalesMetric,
  type DashboardPeriod,
  type SalesMetric,
} from "@/lib/adminConfig";
import {
  getAttentionCounts,
  getAutomotiveAnalytics,
  getCategorySales,
  getCustomersSummary,
  getGeography,
  getImportCenter,
  getOverview,
  getSales,
  getTopProducts,
} from "./dashboardData";
import { getResetState, isDataResetEnabled } from "./resetActions";
import DashboardCard, { EmptyState } from "@/components/admin/dashboard/DashboardCard";
import DataResetCard from "@/components/admin/dashboard/DataResetCard";
import KpiCard from "@/components/admin/dashboard/KpiCard";
import PeriodTabs from "@/components/admin/dashboard/PeriodTabs";
import SalesChart from "@/components/admin/dashboard/SalesChart";
import BarList, { type BarItem } from "@/components/admin/dashboard/BarList";
import {
  AlertIcon,
  CarIcon,
  CartIcon,
  ChartIcon,
  ClipboardIcon,
  FolderIcon,
  ImageIcon,
  MapPinIcon,
  PackageIcon,
  TagIcon,
  UploadIcon,
  UsersIcon,
} from "@/components/admin/dashboard/icons";
import type { Dictionary } from "@/i18n/dictionary";

type Dash = Dictionary["dashboard"];

/** Приветствие по времени в Тбилиси: магазин живёт в этом поясе, а сервер
 * может стоять в UTC. */
function greeting(dict: Dash): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Tbilisi" })
      .format(new Date())
  );
  if (hour < 5) return dict.greetingNight;
  if (hour < 12) return dict.greetingMorning;
  if (hour < 18) return dict.greetingDay;
  return dict.greetingEvening;
}

function periodLabel(period: DashboardPeriod, dict: Dash): string {
  return {
    today: dict.periodToday,
    "7d": dict.period7d,
    "30d": dict.period30d,
    "3m": dict.period3m,
    "12m": dict.period12m,
  }[period];
}

function metricLabel(metric: SalesMetric, dict: Dash): string {
  return { revenue: dict.salesRevenue, orders: dict.salesOrders, units: dict.salesUnits }[metric];
}

const cardGrid = "grid grid-cols-1 gap-4 xl:grid-cols-2";

export default async function AdminDashboardPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Дашборд живёт внутри /admin: доступ уже проверен middleware (src/proxy.ts)
  // и этим вызовом на сервере. Блоки с данными покупателей и импортом
  // показываются только админу — по роли, а не скрытием в разметке.
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const isAdmin = staff.role === "admin";

  const sp = await searchParams;
  const periodParam = single(sp.period);
  const metricParam = single(sp.metric);
  const period: DashboardPeriod = isDashboardPeriod(periodParam)
    ? periodParam
    : DEFAULT_DASHBOARD_PERIOD;
  const metric: SalesMetric = isSalesMetric(metricParam) ? metricParam : "revenue";

  const hrefWith = (next: { period?: string; metric?: string }) => {
    const sp = new URLSearchParams({ period, metric, ...next });
    return `/${locale}/admin?${sp.toString()}`;
  };

  const admin = `/${locale}/admin`;

  return (
    <main className="mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-4 px-2 py-6 sm:gap-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {dict.admin.dashboardTitle}
          </h1>
          <p className="text-zinc-500">
            {greeting(d)}, {staff.firstName} ·{" "}
            {isAdmin ? dict.admin.roleAdmin : dict.admin.roleSeller}
          </p>
        </div>
        <PeriodTabs
          options={DASHBOARD_PERIODS.map((value) => ({ value, label: periodLabel(value, d) }))}
          active={period}
          hrefFor={(value) => hrefWith({ period: value })}
        />
      </header>

      {/* 1. Состояние магазина */}
      <Suspense fallback={<SkeletonRow />}>
        <OverviewRow locale={locale} d={d} period={period} />
      </Suspense>

      {/* 2. Что требует внимания + 6. Excel Import Center */}
      <div className={cardGrid}>
        <Suspense fallback={<SkeletonCard />}>
          <AttentionBlock locale={locale} d={d} isAdmin={isAdmin} />
        </Suspense>
        {isAdmin && (
          <Suspense fallback={<SkeletonCard />}>
            <ImportBlock locale={locale} d={d} />
          </Suspense>
        )}
      </div>

      {/* 3. График продаж */}
      {isAdmin && (
        <Suspense fallback={<SkeletonCard />}>
          <SalesBlock
            locale={locale}
            d={d}
            period={period}
            metric={metric}
            hrefWith={hrefWith}
          />
        </Suspense>
      )}

      {/* 4. Продажи по категориям + 7. Автомобильная аналитика */}
      <div className={cardGrid}>
        {isAdmin && (
          <Suspense fallback={<SkeletonCard />}>
            <CategorySalesBlock locale={locale} d={d} period={period} />
          </Suspense>
        )}
        <Suspense fallback={<SkeletonCard />}>
          <AutomotiveBlock locale={locale} d={d} />
        </Suspense>
      </div>

      {/* 5. Самые продаваемые запчасти */}
      {isAdmin && (
        <Suspense fallback={<SkeletonCard />}>
          <TopProductsBlock
            locale={locale}
            d={d}
            period={period}
            codeLabel={dict.admin.productsColProductCode}
          />
        </Suspense>
      )}

      {/* 8. Незаконченные товары + 9. Клиенты */}
      <div className={cardGrid}>
        <Suspense fallback={<SkeletonCard />}>
          <IncompleteBlock locale={locale} d={d} />
        </Suspense>
        {isAdmin && (
          <Suspense fallback={<SkeletonCard />}>
            <CustomersBlock locale={locale} d={d} period={period} />
          </Suspense>
        )}
      </div>

      {/* 10. География заказов */}
      {isAdmin && (
        <Suspense fallback={<SkeletonCard />}>
          <GeographyBlock d={d} period={period} />
        </Suspense>
      )}

      {/* Обнуление тестовых данных: только админу и только пока в окружении
          стоит ALLOW_DATA_RESET. После запуска магазина достаточно убрать
          переменную — раздел исчезнет без правок кода. */}
      {isAdmin && (await isDataResetEnabled()) && (
        <Suspense fallback={<SkeletonCard />}>
          <ResetBlock locale={locale} d={d} cancelLabel={dict.admin.cancel} />
        </Suspense>
      )}

      <p className="text-xs text-zinc-400">
        <Link href={`${admin}/logs`} className="hover:text-orange-600">
          {dict.admin.navLogs}
        </Link>
      </p>
    </main>
  );
}

// ─── Блоки ───────────────────────────────────────────────────────────────────

async function OverviewRow({
  locale,
  d,
  period,
}: {
  locale: Locale;
  d: Dash;
  period: DashboardPeriod;
}) {
  const overview = await getOverview(period);
  const products = `/${locale}/admin/products`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      <KpiCard label={d.kpiProductsTotal} value={overview.productsTotal} href={products} icon={<PackageIcon />} noDataLabel={d.noData} />
      <KpiCard label={d.kpiInStock} value={overview.inStock} tone="good" href={products} icon={<PackageIcon />} noDataLabel={d.noData} />
      <KpiCard label={d.kpiOutOfStock} value={overview.outOfStock} tone={overview.outOfStock > 0 ? "bad" : "good"} href={products} icon={<AlertIcon />} noDataLabel={d.noData} />
      <KpiCard label={d.kpiLowStock} value={overview.lowStock} tone={overview.lowStock > 0 ? "warn" : "good"} href={products} icon={<AlertIcon />} noDataLabel={d.noData} />
      <KpiCard label={d.kpiCategories} value={overview.categories} href={`/${locale}/admin/categories`} icon={<FolderIcon />} noDataLabel={d.noData} />
      <KpiCard label={d.kpiCarMakes} value={overview.carMakes} icon={<CarIcon />} noDataLabel={d.noData} />
      {/* Просмотров в проекте никто не собирает — честное «нет данных». */}
      <KpiCard label={d.kpiViews} value={overview.views} icon={<ChartIcon />} noDataLabel={d.noData} />
      <KpiCard label={d.kpiOrders} value={overview.ordersInPeriod} tone="info" href={`/${locale}/admin/orders`} icon={<CartIcon />} noDataLabel={d.noData} />
    </div>
  );
}

type AttentionRow = {
  label: string;
  count: number;
  tone: "bad" | "warn" | "info";
  href: string;
  action: string;
  icon: ReactNode;
};

async function AttentionBlock({
  locale,
  d,
  isAdmin,
}: {
  locale: Locale;
  d: Dash;
  isAdmin: boolean;
}) {
  const counts = await getAttentionCounts();
  const products = `/${locale}/admin/products`;

  // Код продукта в этот список намеренно не входит: APLUS KOD обязателен на
  // валидации импорта, поэтому товара без него в каталоге быть не может.
  const rows: AttentionRow[] = [
    { label: d.attentionOutOfStock, count: counts.outOfStock, tone: "bad" as const, href: products, action: d.actionOpen, icon: <AlertIcon /> },
    { label: d.attentionLowStock, count: counts.lowStock, tone: "warn" as const, href: products, action: d.actionCheck, icon: <AlertIcon /> },
    { label: d.attentionNoPhoto, count: counts.withoutPhoto, tone: "warn" as const, href: products, action: d.actionOpen, icon: <ImageIcon /> },
    { label: d.attentionNoPrice, count: counts.withoutPrice, tone: "bad" as const, href: products, action: d.actionCheck, icon: <TagIcon /> },
    ...(isAdmin
      ? [
          {
            label: d.attentionNoCategory,
            count: counts.withoutCategory,
            tone: "warn" as const,
            href: `/${locale}/admin/categories/uncategorized`,
            action: d.actionDistribute,
            icon: <FolderIcon />,
          },
        ]
      : []),
    { label: d.attentionNoVehicle, count: counts.withoutVehicle, tone: "info" as const, href: products, action: d.actionCheck, icon: <CarIcon /> },
    ...(isAdmin && counts.importConflicts > 0
      ? [
          {
            label: d.attentionImportConflicts,
            count: counts.importConflicts,
            tone: "warn" as const,
            href: products,
            action: d.actionCheck,
            icon: <UploadIcon />,
          },
        ]
      : []),
  ].filter((row) => row.count > 0);

  const toneText = {
    bad: "text-red-600 dark:text-red-500",
    warn: "text-amber-600 dark:text-amber-500",
    info: "text-blue-600 dark:text-blue-500",
  };

  return (
    <DashboardCard title={d.attentionTitle} icon={<AlertIcon />}>
      {rows.length === 0 ? (
        <EmptyState text={d.attentionAllGood} />
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className={`shrink-0 ${toneText[row.tone]}`}>{row.icon}</span>
              <span className={`shrink-0 text-lg font-bold tabular-nums ${toneText[row.tone]}`}>
                {row.count.toLocaleString("ru-RU")}
              </span>
              <span className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                {row.label}
                {row.label === d.attentionLowStock && (
                  <span className="text-zinc-400"> (≤ {LOW_STOCK_THRESHOLD})</span>
                )}
              </span>
              <Link
                href={row.href}
                className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                {row.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

async function ImportBlock({ locale, d }: { locale: Locale; d: Dash }) {
  const { last, unresolvedConflicts } = await getImportCenter();

  return (
    <DashboardCard
      title={d.importTitle}
      icon={<UploadIcon />}
      action={{ label: d.importNewButton, href: `/${locale}/admin/products` }}
    >
      {last === null ? (
        <EmptyState text={d.importNone} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/40">
            <span className="text-xs uppercase tracking-wide text-zinc-500">{d.importLast}</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {last.summary}
            </span>
            <span className="text-xs text-zinc-400">
              {new Date(last.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Tbilisi" })} ·{" "}
              {last.staffName}
            </span>
          </div>

          {unresolvedConflicts > 0 && (
            <p className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-500">
              <span>
                {d.importConflictsLabel}: <strong className="tabular-nums">{unresolvedConflicts}</strong>
              </span>
              <Link href={`/${locale}/admin/products`} className="font-medium hover:underline">
                {d.actionCheck}
              </Link>
            </p>
          )}

          <p className="text-xs text-zinc-400">{d.importLogHint}</p>
        </div>
      )}
    </DashboardCard>
  );
}

async function SalesBlock({
  locale,
  d,
  period,
  metric,
  hrefWith,
}: {
  locale: Locale;
  d: Dash;
  period: DashboardPeriod;
  metric: SalesMetric;
  hrefWith: (next: { period?: string; metric?: string }) => string;
}) {
  const sales = await getSales(period, locale);
  const headline =
    metric === "revenue"
      ? formatGel(sales.revenue, locale)
      : (metric === "orders" ? sales.orders : sales.units).toLocaleString("ru-RU");

  return (
    <DashboardCard title={`${d.salesTitle} · ${periodLabel(period, d)}`} icon={<ChartIcon />}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {headline}
          </span>
          {sales.revenueChange !== null && metric === "revenue" && (
            <span
              className={`text-sm font-medium ${
                sales.revenueChange >= 0
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-red-600 dark:text-red-500"
              }`}
            >
              {sales.revenueChange >= 0 ? "+" : ""}
              {sales.revenueChange.toFixed(1)}% {d.salesVsPrevious}
            </span>
          )}
        </div>
        <PeriodTabs
          options={SALES_METRICS.map((value) => ({ value, label: metricLabel(value, d) }))}
          active={metric}
          hrefFor={(value) => hrefWith({ metric: value })}
        />
      </div>

      <SalesChart points={sales.points} metric={metric} emptyLabel={d.salesEmpty} />
    </DashboardCard>
  );
}

async function CategorySalesBlock({
  locale,
  d,
  period,
}: {
  locale: Locale;
  d: Dash;
  period: DashboardPeriod;
}) {
  const categories = await getCategorySales(period, locale);
  const items: BarItem[] = categories.slice(0, 8).map((category) => ({
    label: category.label,
    value: category.units,
    note: formatGel(category.revenue, locale),
    href: `/${locale}/catalog/category/${category.slug}`,
  }));

  return (
    <DashboardCard title={d.categorySalesTitle} icon={<FolderIcon />}>
      {items.length === 0 ? <EmptyState text={d.categorySalesEmpty} /> : <BarList items={items} />}
    </DashboardCard>
  );
}

async function AutomotiveBlock({ locale, d }: { locale: Locale; d: Dash }) {
  const analytics = await getAutomotiveAnalytics(locale);
  const items: BarItem[] = analytics.makes.map((make) => ({
    label: make.label,
    value: make.products,
  }));

  return (
    <DashboardCard title={d.automotiveTitle} icon={<CarIcon />}>
      {items.length === 0 ? (
        <EmptyState text={d.automotiveEmpty} />
      ) : (
        <>
          <BarList items={items} />
          <div className="flex flex-wrap gap-4 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
            <span className="text-zinc-500">
              {d.automotiveUniversal}:{" "}
              <strong className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {analytics.universal}
              </strong>
            </span>
            <span className="text-zinc-500">
              {d.automotiveNoModel}:{" "}
              <strong className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {analytics.withoutModel}
              </strong>
            </span>
          </div>
        </>
      )}
    </DashboardCard>
  );
}

async function TopProductsBlock({
  locale,
  d,
  period,
  codeLabel,
}: {
  locale: Locale;
  d: Dash;
  period: DashboardPeriod;
  /** Подпись колонки кода берём из словаря админки — она там уже переведена. */
  codeLabel: string;
}) {
  const products = await getTopProducts(period, locale);

  return (
    <DashboardCard
      title={d.topProductsTitle}
      icon={<ClipboardIcon />}
      action={{ label: d.viewAll, href: `/${locale}/admin/products` }}
    >
      {products.length === 0 ? (
        <EmptyState text={d.topProductsEmpty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="pb-2 font-medium">{d.colProduct}</th>
                <th className="pb-2 font-medium">{codeLabel}</th>
                <th className="pb-2 font-medium">{d.colSold}</th>
                <th className="pb-2 font-medium">{d.colStock}</th>
                <th className="pb-2 font-medium">{d.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {products.map((product) => {
                const status =
                  product.stock <= 0
                    ? { label: d.statusOut, tone: "text-red-600 dark:text-red-500" }
                    : product.stock <= LOW_STOCK_THRESHOLD
                      ? { label: d.statusLow, tone: "text-amber-600 dark:text-amber-500" }
                      : { label: d.statusOk, tone: "text-emerald-600 dark:text-emerald-500" };
                return (
                  <tr key={product.id}>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/${locale}/catalog/${product.slug}`}
                        className="font-medium text-zinc-900 hover:text-orange-600 dark:text-zinc-50"
                      >
                        {product.name}
                      </Link>
                      {product.categoryLabel && (
                        <span className="block text-xs text-zinc-400">{product.categoryLabel}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-500">{product.productCode || "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {product.sold}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-500">{product.stock}</td>
                    <td className={`py-2.5 font-medium ${status.tone}`}>{status.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}

async function IncompleteBlock({ locale, d }: { locale: Locale; d: Dash }) {
  const counts = await getAttentionCounts();
  const items: BarItem[] = [
    { label: d.attentionNoCategory, value: counts.withoutCategory },
    { label: d.attentionNoPhoto, value: counts.withoutPhoto },
    { label: d.attentionNoVehicle, value: counts.withoutVehicle },
    { label: d.attentionNoPrice, value: counts.withoutPrice },
  ].filter((item) => item.value > 0);

  return (
    <DashboardCard
      title={d.incompleteTitle}
      icon={<ClipboardIcon />}
      action={{ label: d.viewAll, href: `/${locale}/admin/products` }}
    >
      {items.length === 0 ? <EmptyState text={d.incompleteEmpty} /> : <BarList items={items} />}
    </DashboardCard>
  );
}

async function CustomersBlock({
  locale,
  d,
  period,
}: {
  locale: Locale;
  d: Dash;
  period: DashboardPeriod;
}) {
  const customers = await getCustomersSummary(period);

  return (
    <DashboardCard
      title={d.customersTitle}
      icon={<UsersIcon />}
      action={{ label: d.viewAll, href: `/${locale}/admin/customers` }}
    >
      {customers.total === 0 ? (
        <EmptyState text={d.customersEmpty} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-6">
            <span className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-zinc-500">{d.customersTotal}</span>
              <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {customers.total}
              </span>
            </span>
            <span className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-zinc-500">{d.customersNew}</span>
              <span className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
                {customers.newInPeriod}
              </span>
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {customers.latest.map((customer) => (
              <li key={`${customer.name}-${customer.createdAt}`} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{customer.name}</span>
                <span className="text-zinc-500">
                  {customer.organization}
                  {customer.city ? ` · ${customer.city}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}

async function GeographyBlock({ d, period }: { d: Dash; period: DashboardPeriod }) {
  const cities = await getGeography(period);
  const items: BarItem[] = cities.slice(0, 10).map((city) => ({
    label: city.city,
    value: city.orders,
    note: `${city.orders} ${d.geographyOrders}`,
  }));

  return (
    <DashboardCard title={d.geographyTitle} icon={<MapPinIcon />}>
      {items.length === 0 ? <EmptyState text={d.geographyEmpty} /> : <BarList items={items} />}
    </DashboardCard>
  );
}

async function ResetBlock({
  locale,
  d,
  cancelLabel,
}: {
  locale: Locale;
  d: Dash;
  cancelLabel: string;
}) {
  const state = await getResetState(locale);
  return <DataResetCard locale={locale} d={d} state={state} cancelLabel={cancelLabel} />;
}

// ─── Заглушки загрузки ───────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
  );
}

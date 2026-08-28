import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { signOutAction } from "./actions";

export default async function AdminDashboardLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);
  const isAdmin = staff.role === "admin";

  const navItems = [
    { href: `/${locale}/admin`, label: dict.admin.navDashboard, show: true },
    { href: `/${locale}/admin/staff/admins`, label: dict.admin.navStaffAdmins, show: isAdmin },
    { href: `/${locale}/admin/staff/sellers`, label: dict.admin.navStaffSellers, show: isAdmin },
    { href: `/${locale}/admin/customers`, label: dict.admin.navCustomers, show: isAdmin },
    { href: `/${locale}/admin/brands`, label: dict.admin.navBrands, show: isAdmin },
    { href: `/${locale}/admin/warehouses`, label: dict.admin.navWarehouses, show: isAdmin },
    { href: `/${locale}/admin/products`, label: dict.admin.navProducts, show: true },
    { href: `/${locale}/admin/orders`, label: dict.admin.navOrders, show: true },
    { href: `/${locale}/admin/logs`, label: dict.admin.navLogs, show: isAdmin },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-sky-50 px-6 py-4 dark:border-zinc-800 dark:bg-black print:hidden">
        <Link
          href={`/${locale}`}
          className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          ARAZ MOTORS<span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">-2026</span>
        </Link>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="h-8 w-[104px]" />}>
            <LanguageSwitcher locale={locale} ariaLabel={dict.header.languageSwitcherAriaLabel} />
          </Suspense>
          <ThemeToggle ariaLabel={dict.header.themeToggleAriaLabel} />
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              {dict.admin.logout}
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-zinc-200 bg-sky-50 px-4 py-6 dark:border-zinc-800 dark:bg-black print:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
          </nav>

          <div className="mt-auto flex flex-col gap-1 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <span className="px-3 pb-1 text-xs text-zinc-500">
              {staff.firstName} {staff.lastName} ·{" "}
              {isAdmin ? dict.admin.roleAdmin : dict.admin.roleSeller}
            </span>
            <Link
              href={`/${locale}/admin/account`}
              className="rounded-lg px-3 py-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              {dict.admin.navChangePassword}
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

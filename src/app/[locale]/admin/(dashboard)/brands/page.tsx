import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { single } from "@/lib/searchParams";
import BrandsListClient, { type BrandRow } from "./BrandsListClient";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import Pagination, { ADMIN_PAGE_SIZE } from "@/components/admin/Pagination";

export default async function AdminBrandsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/brands">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Brands isn't part of a seller's permitted scope (view/search products,
  // change order status/price) — admin-only, including viewing.
  const staff = await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const query = single(sp.q)?.trim() ?? "";
  const page = Number(single(sp.page)) || 1;
  const from = (page - 1) * ADMIN_PAGE_SIZE;

  // Считает и режет Postgres — как на остальных страницах панели, чтобы
  // список не тянулся целиком, когда брендов станет много.
  const supabase = await createClient();
  let request = supabase
    .from("brands")
    .select("id, slug, name, logo_url, badge_logo_url, initials", { count: "exact" });
  if (query) request = request.ilike("name", `%${query.replace(/[,()]/g, "")}%`);

  const { data, count } = await request
    .order("name")
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  const brands: BrandRow[] = (data ?? []).map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    initials: b.initials,
    logoUrl: b.logo_url,
    badgeLogoUrl: b.badge_logo_url,
  }));

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <BrandsListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={staff.role === "admin"}
        brands={brands}
        searchSlot={
          <form key="search" className="flex items-center gap-2">
            <AdminSearchBox defaultValue={query} placeholder={dict.admin.searchPlaceholder} />
          </form>
        }
      />

      <Pagination
        basePath={`/${locale}/admin/brands`}
        currentPage={page}
        total={count ?? 0}
        searchParams={{ q: query || undefined }}
      />
    </main>
  );
}

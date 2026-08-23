import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BrandsListClient, { type BrandRow } from "./BrandsListClient";

export default async function AdminBrandsPage({
  params,
}: PageProps<"/[locale]/admin/brands">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);

  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, slug, name, logo_url, badge_logo_url")
    .order("name");

  const brands: BrandRow[] = (data ?? []).map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    logoUrl: b.logo_url,
    badgeLogoUrl: b.badge_logo_url,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <BrandsListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={staff.role === "admin"}
        brands={brands}
      />
    </main>
  );
}

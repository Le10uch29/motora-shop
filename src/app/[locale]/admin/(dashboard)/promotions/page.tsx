import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPromoIds, PROMO_LIMIT } from "@/lib/promotions";
import type { LocalizedText } from "@/lib/products";
import PromoListEditor, { type PromoItem } from "./PromoListEditor";

/** Товары подборки в её порядке — с тем, что нужно строке редактора. */
async function loadItems(ids: string[], locale: Locale): Promise<PromoItem[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("id, name, product_code, images, price, stock")
    .in("id", ids);
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const name = row.name as LocalizedText;
    return [
      {
        id,
        name: name[locale] || name.ru,
        productCode: row.product_code ?? null,
        image: (row.images as string[] | null)?.[0] ?? null,
        price: Number(row.price),
        stock: row.stock,
      },
    ];
  });
}

/** «Популярное» до первого сохранения — это товары с галочкой «популярный»,
 * как их и показывала главная; редактор открывается уже с ними. */
async function popularFromFlag(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("id")
    .eq("is_popular", true)
    .order("created_at", { ascending: false })
    .limit(PROMO_LIMIT);
  return (data ?? []).map((row) => row.id);
}

export default async function AdminPromotionsPage({
  params,
}: PageProps<"/[locale]/admin/promotions">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const [popularIds, newIds] = await Promise.all([getPromoIds("popular"), getPromoIds("new")]);
  const [popular, arrivals] = await Promise.all([
    loadItems(popularIds ?? (await popularFromFlag()), locale),
    loadItems(newIds ?? [], locale),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.admin.promotionsTitle}
        </h1>
        <p className="max-w-3xl text-sm text-zinc-500">{dict.admin.promotionsHint}</p>
      </div>

      <PromoListEditor
        locale={locale}
        dict={dict.admin}
        kind="popular"
        title={dict.admin.promoPopularTitle}
        limit={PROMO_LIMIT}
        initialItems={popular}
      />
      <PromoListEditor
        locale={locale}
        dict={dict.admin}
        kind="new"
        title={dict.admin.promoNewTitle}
        limit={PROMO_LIMIT}
        initialItems={arrivals}
      />
    </main>
  );
}

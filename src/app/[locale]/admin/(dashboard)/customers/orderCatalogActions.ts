"use server";

import { requireStaff } from "@/lib/auth";
import { getCatalogPage, makeLabel, t } from "@/lib/products";
import { getCatalogBrands, getBrands } from "@/lib/brands";
import { primaryOem } from "@/lib/oem";
import type { Locale } from "@/i18n/locales";

/** Карточка товара в окне «Заказ вместо покупателя» — то, что показывает
 * карточка каталога на сайте, уже собранное в строки: сама карточка сайта
 * серверная и тянет за собой серверный клиент Supabase, в модалку её не
 * вставить. */
export type OrderCatalogCard = {
  id: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  /** Код магазина с префиксом бренда, как на карточке сайта: «EL-12345». */
  productCode: string | null;
  originCode: string | null;
  brandName: string | null;
  brandBadge: string | null;
  /** «Toyota Camry, MAN TGA» — к каким машинам подходит. */
  vehicles: string;
  /** Сколько можно заказать: остаток минус занятое неотправленными заказами. */
  stock: number;
};

export type OrderCatalogBrand = { slug: string; name: string; badgeLogoUrl: string | null };

/** Сколько карточек на странице: на полном экране это 2–5 рядов. Модалка
 * листает по total, сам размер ей знать не нужно — он приходит как pageSize. */
const PAGE_SIZE = 20;

/** Бренды для фильтра — те же, что в фильтре каталога на сайте. */
export async function getOrderCatalogBrandsAction(locale: Locale): Promise<OrderCatalogBrand[]> {
  await requireStaff(locale);
  const brands = await getCatalogBrands();
  return brands.map((brand) => ({ slug: brand.slug, name: brand.name, badgeLogoUrl: brand.badgeLogoUrl }));
}

/**
 * Страница каталога для заказа из админки: тот же поиск и тот же порядок, что
 * в каталоге сайта (getCatalogPage) — товары в наличии впереди, закончившиеся
 * в конце и серыми. Сотрудник видит каталог глазами покупателя.
 *
 * Только для сотрудников: окно открывают из «Покупателей» (админ и старший
 * продавец) и из заказа — «Добавить товар» (любой сотрудник).
 */
export async function getOrderCatalogPageAction(
  locale: Locale,
  filters: { query?: string; brand?: string },
  page: number
): Promise<{ items: OrderCatalogCard[]; total: number; pageSize: number }> {
  await requireStaff(locale);
  const query = filters.query?.trim() || undefined;
  const brand = filters.brand || undefined;

  const [{ items, total }, brands] = await Promise.all([
    getCatalogPage({ query, brand }, locale, page, PAGE_SIZE),
    getBrands(),
  ]);

  const cards = items.map((product): OrderCatalogCard => {
    const productBrand = brands.find((b) => b.slug === product.brand);
    const vehicles = [
      ...new Set(
        product.fitments
          .filter((fitment) => fitment.make)
          .map((fitment) => `${makeLabel(fitment.make, locale)} ${fitment.model ?? ""}`.trim())
      ),
    ].join(", ");
    return {
      id: product.id,
      name: t(product.name, locale) || product.name.ru || "—",
      price: product.price,
      oldPrice: product.oldPrice ?? null,
      image: product.images?.[0] ?? null,
      productCode: product.productCode
        ? productBrand?.initials
          ? `${productBrand.initials}-${product.productCode}`
          : product.productCode
        : null,
      originCode: product.originCode ? primaryOem(product.originCode) : null,
      brandName: productBrand?.name ?? null,
      brandBadge: productBrand?.badgeLogoUrl ?? null,
      vehicles,
      stock: product.stock,
    };
  });

  return { items: cards, total, pageSize: PAGE_SIZE };
}

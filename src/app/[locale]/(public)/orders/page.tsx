import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { getMyOrderHistory } from "@/lib/orderHistory";
import OrderHistory from "@/components/OrderHistory";
import Breadcrumbs from "@/components/Breadcrumbs";

/**
 * «Мои заказы» — история заказов вошедшего покупателя (раньше была под
 * корзиной). Только просмотр: удалить заказы из истории покупатель не может,
 * это делает админ или старший продавец из окна «Корзина покупателя».
 */
export default async function MyOrdersPage({ params }: PageProps<"/[locale]/orders">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const history = await getMyOrderHistory(locale);

  const a = dict.admin;
  const statusLabels: Record<string, string> = {
    new: a.orderStatusNew,
    gathering: a.orderStatusGathering,
    gathered: a.orderStatusGathered,
    shipped: a.orderStatusShipped,
    delivered: a.orderStatusDelivered,
    cancelled: a.orderStatusCancelled,
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-2 px-2 py-10">
      <Breadcrumbs
        locale={locale}
        labels={{ home: dict.catalog.breadcrumbHome, back: dict.catalog.backButton }}
        items={[{ label: dict.header.myOrders }]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{dict.header.myOrders}</h1>
      <OrderHistory locale={locale} dict={dict.cart} history={history} statusLabels={statusLabels} embedded />
    </main>
  );
}

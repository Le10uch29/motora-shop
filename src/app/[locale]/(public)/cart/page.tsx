import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { getProductsForCart } from "@/lib/products";
import { getMyOrderHistory } from "@/lib/orderHistory";
import CartView from "@/components/CartView";
import OrderHistory from "@/components/OrderHistory";
import Breadcrumbs from "@/components/Breadcrumbs";

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const [products, history] = await Promise.all([getProductsForCart(), getMyOrderHistory(locale)]);

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
    <>
      <CartView
        locale={locale}
        dict={dict.cart}
        products={products}
        breadcrumbs={
          <Breadcrumbs
            key="breadcrumbs"
            locale={locale}
            labels={{ home: dict.catalog.breadcrumbHome, back: dict.catalog.backButton }}
            items={[{ label: dict.cart.title }]}
          />
        }
      />
      <OrderHistory locale={locale} dict={dict.cart} history={history} statusLabels={statusLabels} />
    </>
  );
}

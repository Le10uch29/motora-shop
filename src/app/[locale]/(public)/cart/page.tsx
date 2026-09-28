import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { getProductsForCart } from "@/lib/products";
import CartView from "@/components/CartView";
import Breadcrumbs from "@/components/Breadcrumbs";

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const products = await getProductsForCart();

  return (
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
  );
}

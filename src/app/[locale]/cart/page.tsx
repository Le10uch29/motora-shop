import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { getAllProducts } from "@/lib/products";
import CartView from "@/components/CartView";

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const products = await getAllProducts();

  return <CartView locale={locale} dict={dict.cart} products={products} />;
}

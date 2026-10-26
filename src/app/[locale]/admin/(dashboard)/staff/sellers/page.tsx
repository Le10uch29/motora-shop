import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/locales";

/** Старый адрес: админы и продавцы теперь в одном разделе «Администрация». */
export default async function SellersPage({ params }: PageProps<"/[locale]/admin/staff/sellers">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/admin/staff`);
}

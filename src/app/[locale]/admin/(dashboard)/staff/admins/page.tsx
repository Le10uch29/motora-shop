import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/locales";

/** Старый адрес: админы и продавцы теперь в одном разделе «Администрация». */
export default async function AdminsPage({ params }: PageProps<"/[locale]/admin/staff/admins">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/admin/staff?role=admin`);
}

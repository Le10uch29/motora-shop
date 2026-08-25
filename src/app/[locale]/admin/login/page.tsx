import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import AdminLoginForm from "./AdminLoginForm";

export default async function AdminLoginPage({
  params,
}: PageProps<"/[locale]/admin/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <AdminLoginForm
      locale={locale}
      title={dict.auth.adminLoginTitle}
      identifierLabel={dict.admin.identifierLabel}
      passwordLabel={dict.auth.passwordLabel}
      submitLabel={dict.auth.submit}
      invalidCredentialsMessage={dict.auth.invalidCredentials}
    />
  );
}

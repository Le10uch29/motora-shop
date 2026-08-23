import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import AuthForm from "@/components/AuthForm";

export default async function LoginPage({
  params,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <AuthForm
      title={dict.auth.userLoginTitle}
      emailLabel={dict.auth.emailLabel}
      passwordLabel={dict.auth.passwordLabel}
      submitLabel={dict.auth.submit}
      note={dict.auth.note}
    />
  );
}

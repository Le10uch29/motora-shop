import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";

// A real route group (not just a runtime pathname check in the shared root
// layout) — /admin lives in its own sibling segment with its own layout, so
// Next.js properly mounts/unmounts between them on client-side navigation.
// The old approach (reading x-pathname in the root layout to decide whether
// to render <Header>) looked right but wasn't: App Router can reuse an
// already-rendered parent segment across a navigation instead of re-running
// it, so the storefront header stayed mounted after navigating into /admin
// (which renders its own header) until a full page reload forced a fresh
// render — i.e. exactly the "header duplicates until refresh" bug.
export default async function PublicLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <>
      <Header locale={locale} dict={dict} />
      {children}
    </>
  );
}

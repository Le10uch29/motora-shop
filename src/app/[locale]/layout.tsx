import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { LOCALE_KEY, THEME_KEY } from "@/lib/preferences";
import "../globals.css";
import { CartProvider } from "@/context/CartContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { locales, isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { createClient } from "@/lib/supabase/server";
import { getAuthIdentity } from "@/lib/supabase/authUsers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: `${dict.home.brand} — ${dict.home.heroTitle}`,
    description: dict.home.heroSubtitle,
    // Закрытый магазин не индексируется (см. также src/app/robots.ts).
    // Страницы каталога задают только title/description, robots наследуют.
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const supabase = await createClient();
  const [user, dict, cookieStore] = await Promise.all([
    getAuthIdentity(supabase),
    getDictionary(locale),
    cookies(),
  ]);
  // Тема приходит с сервера, из cookie: <html> рисуется заново при каждой
  // смене языка, и класс, поставленный скриптом в браузере, при этом терялся —
  // тёмная тема сбрасывалась на светлую.
  const dark = cookieStore.get(THEME_KEY)?.value === "dark";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${dark ? " dark" : ""}`}
      // The script below may still add .dark before React hydrates (a visitor
      // whose choice so far lives only in localStorage), so the class can
      // legitimately differ from what was server-rendered.
      suppressHydrationWarning
    >
      <head>
        {/* Посетитель, выбравший тему или язык до появления cookie, хранит
            выбор только в localStorage: скрипт применяет тему до отрисовки и
            переносит оба значения в cookie, чтобы дальше их знал и сервер. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var y=31536000,c=document.cookie,t=localStorage.getItem('${THEME_KEY}'),l=localStorage.getItem('${LOCALE_KEY}');if(t==='dark'){document.documentElement.classList.add('dark')}if(t&&c.indexOf('${THEME_KEY}=')<0){document.cookie='${THEME_KEY}='+t+';path=/;max-age='+y+';samesite=lax'}if(l&&c.indexOf('${LOCALE_KEY}=')<0){document.cookie='${LOCALE_KEY}='+l+';path=/;max-age='+y+';samesite=lax'}}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-zinc-50 dark:bg-black">
        <ConfirmProvider dict={dict.confirmDialog}>
          <CartProvider userId={user?.id ?? null}>{children}</CartProvider>
        </ConfirmProvider>
      </body>
    </html>
  );
}

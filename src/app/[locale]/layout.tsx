import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { CartProvider } from "@/context/CartContext";
import { locales, isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { createClient } from "@/lib/supabase/server";

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
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The blocking script below adds .dark to this element before React
      // hydrates (that's the point — it prevents a light-then-dark flash for
      // returning dark-theme visitors), so its class attribute legitimately
      // differs from what was server-rendered. That's expected, not a bug.
      suppressHydrationWarning
    >
      <head>
        {/* Runs before paint so a returning visitor who chose dark doesn't
            flash light first — first-time visitors have nothing stored, so
            this does nothing and they see the light theme, as intended. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('araz-motors-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-zinc-50 dark:bg-black">
        <CartProvider userId={user?.id ?? null}>{children}</CartProvider>
      </body>
    </html>
  );
}

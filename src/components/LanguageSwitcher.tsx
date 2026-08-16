"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { locales, type Locale } from "@/i18n/locales";

const LABELS: Record<Locale, string> = { ru: "RU", az: "AZ", ka: "KA" };

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  function pathFor(target: Locale) {
    const segments = pathname.split("/");
    segments[1] = target;
    const path = segments.join("/") || "/";
    return query ? `${path}?${query}` : path;
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-zinc-200 p-1 text-xs font-medium dark:border-zinc-700">
      {locales.map((l) => (
        <Link
          key={l}
          href={pathFor(l)}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            l === locale
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "text-zinc-600 hover:text-orange-600 dark:text-zinc-400"
          }`}
        >
          {LABELS[l]}
        </Link>
      ))}
    </div>
  );
}

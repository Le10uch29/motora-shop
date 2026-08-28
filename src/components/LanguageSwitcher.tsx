"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { locales, type Locale } from "@/i18n/locales";

const FLAGS: Record<Locale, string> = { ru: "🇷🇺", az: "🇦🇿", ka: "🇬🇪" };
const LABELS: Record<Locale, string> = { ru: "RU", az: "AZ", ka: "KA" };

export default function LanguageSwitcher({
  locale,
  ariaLabel,
}: {
  locale: Locale;
  ariaLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  function pathFor(target: Locale): string {
    const segments = pathname.split("/");
    segments[1] = target;
    const path = segments.join("/") || "/";
    return query ? `${path}?${query}` : path;
  }

  return (
    <select
      value={locale}
      onChange={(event) => router.push(pathFor(event.target.value as Locale))}
      aria-label={ariaLabel}
      className="rounded-full border border-zinc-200 bg-transparent px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
    >
      {locales.map((l) => (
        <option key={l} value={l} className="bg-white text-zinc-900">
          {FLAGS[l]} {LABELS[l]}
        </option>
      ))}
    </select>
  );
}

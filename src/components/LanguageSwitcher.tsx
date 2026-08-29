"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { locales, type Locale } from "@/i18n/locales";

// Transparent-background flag badges in /public — a native <select> can't
// render <img> inside its <option> list (browsers just strip it), so this
// is a custom dropdown instead of a plain <select>.
const FLAG_SRC: Record<Locale, string> = { ru: "/ru.webp", az: "/aze.webp", ka: "/ka.webp" };
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function pathFor(target: Locale): string {
    const segments = pathname.split("/");
    segments[1] = target;
    const path = segments.join("/") || "/";
    return query ? `${path}?${query}` : path;
  }

  function select(target: Locale) {
    setOpen(false);
    if (target !== locale) router.push(pathFor(target));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 dark:border-zinc-700 dark:text-zinc-200"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FLAG_SRC[locale]} alt="" className="h-4 w-4 object-contain" />
        {LABELS[locale]}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 flex min-w-[92px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => select(l)}
              className={`flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                l === locale ? "text-orange-600" : "text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={FLAG_SRC[l]} alt="" className="h-4 w-4 object-contain" />
              {LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/locales";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type NavLink = { href: string; label: string };

export default function MobileMenu({
  locale,
  navLinks,
  menuAriaLabel,
  closeMenuAriaLabel,
}: {
  locale: Locale;
  navLinks: NavLink[];
  menuAriaLabel: string;
  closeMenuAriaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? closeMenuAriaLabel : menuAriaLabel}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-200"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="h-5 w-5"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 flex max-h-[80vh] flex-col overflow-y-auto border-t border-zinc-200 bg-white px-6 py-6 shadow-lg dark:border-zinc-800 dark:bg-black">
          <nav className="flex flex-col gap-1 text-base font-medium text-zinc-700 dark:text-zinc-300">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-3 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <Suspense fallback={<div className="h-8 w-[104px]" />}>
              <LanguageSwitcher locale={locale} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

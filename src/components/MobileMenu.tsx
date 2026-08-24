"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/locales";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { signOutAction } from "@/lib/actions/auth";

type NavLink = { href: string; label: string };

export default function MobileMenu({
  locale,
  navLinks,
  menuAriaLabel,
  closeMenuAriaLabel,
  loginHref,
  loginLabel,
  isLoggedIn,
  logoutLabel,
  accountHref,
  accountLabel,
}: {
  locale: Locale;
  navLinks: NavLink[];
  menuAriaLabel: string;
  closeMenuAriaLabel: string;
  loginHref: string;
  loginLabel: string;
  isLoggedIn: boolean;
  logoutLabel: string;
  accountHref?: string;
  accountLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div>
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
            {isLoggedIn && accountHref && (
              <Link
                href={accountHref}
                className="flex items-center gap-2 rounded-lg px-3 py-3 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-5 w-5"
                >
                  <circle cx="12" cy="8" r="3.2" />
                  <path strokeLinecap="round" d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
                </svg>
                {accountLabel}
              </Link>
            )}
            {isLoggedIn ? (
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-900"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  {logoutLabel}
                </button>
              </form>
            ) : (
              <Link
                href={loginHref}
                className="flex items-center gap-2 rounded-lg px-3 py-3 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-5 w-5"
                >
                  <circle cx="12" cy="8" r="3.2" />
                  <path strokeLinecap="round" d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
                </svg>
                {loginLabel}
              </Link>
            )}
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

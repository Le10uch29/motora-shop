"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/locales";

export type SidebarSubcategory = { slug: string; label: string; count: number };
export type SidebarCategory = SidebarSubcategory & { children: SidebarSubcategory[] };

/**
 * Categories down the left of the catalog.
 *
 * "Все товары" comes first and is not a category at all — it's the same
 * catalog with no category filter, which is why its link carries no category
 * segment. "Разное" is already filtered out by the caller: its products are
 * counted in their category's total but it never appears as an entry of its
 * own.
 *
 * Every link keeps whatever filters are already applied (make, model, years,
 * search) and only drops `page` — moving from a category to one of its
 * subcategories should narrow the same search, not start a new one.
 */
export default function CategorySidebar({
  locale,
  labels,
  categories,
  allProductsCount,
  activeCategorySlug,
  activeSubcategorySlug,
}: {
  locale: Locale;
  /** Only the strings this component prints, not the whole `dict.catalog`:
   * that namespace holds functions (productCount, forQuery) for the server
   * components, and a function cannot cross into a Client Component. */
  labels: { allProducts: string; categoriesTitle: string; toggleSubcategoriesAria: string };
  categories: SidebarCategory[];
  allProductsCount: number;
  activeCategorySlug?: string;
  activeSubcategorySlug?: string;
}) {
  // The open category starts open; the rest are closed until clicked.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(activeCategorySlug ? [activeCategorySlug] : [])
  );
  const searchParams = useSearchParams();

  function hrefWithFilters(path: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  function toggle(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  // Roomier rows and a bigger chevron on a phone: these are thumb targets
  // there, and a pointer-sized one is easy to miss.
  const itemClass =
    "block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-zinc-100 lg:py-2 dark:hover:bg-zinc-800";
  const activeClass = "bg-orange-50 font-semibold text-orange-600 dark:bg-orange-950/40";
  const idleClass = "text-zinc-700 dark:text-zinc-300";

  return (
    <nav className="flex flex-col gap-1" aria-label={labels.categoriesTitle}>
      <Link
        href={hrefWithFilters(`/${locale}/catalog`)}
        className={`${itemClass} ${!activeCategorySlug ? activeClass : idleClass}`}
      >
        {labels.allProducts}
        <span className="ml-1 text-zinc-400">({allProductsCount})</span>
      </Link>

      {categories.map((category) => {
        const isActive = category.slug === activeCategorySlug;
        const isOpen = expanded.has(category.slug);
        return (
          <div key={category.slug} className="flex flex-col">
            <div className="flex items-center">
              <Link
                href={hrefWithFilters(`/${locale}/catalog/category/${category.slug}`)}
                className={`${itemClass} min-w-0 flex-1 ${
                  isActive && !activeSubcategorySlug ? activeClass : idleClass
                }`}
              >
                {category.label}
                <span className="ml-1 text-zinc-400">({category.count})</span>
              </Link>
              {category.children.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggle(category.slug)}
                  aria-expanded={isOpen}
                  aria-label={labels.toggleSubcategoriesAria}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-orange-600 lg:h-8 lg:w-8"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
            </div>

            {isOpen && category.children.length > 0 && (
              <div className="ml-3 flex flex-col gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                {category.children.map((child) => (
                  <Link
                    key={child.slug}
                    href={hrefWithFilters(
                      `/${locale}/catalog/category/${category.slug}/${child.slug}`
                    )}
                    className={`${itemClass} ${
                      child.slug === activeSubcategorySlug ? activeClass : idleClass
                    }`}
                  >
                    {child.label}
                    <span className="ml-1 text-zinc-400">({child.count})</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

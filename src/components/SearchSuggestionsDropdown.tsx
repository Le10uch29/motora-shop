"use client";

import Link from "next/link";
import type { SearchSuggestion } from "@/lib/actions/search";
import { formatGel } from "@/lib/currency";
import ProductVisual from "@/components/ProductVisual";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";

export default function SearchSuggestionsDropdown({
  locale,
  dict,
  results,
  total,
  loading,
  highlightedIndex,
  viewAllHref,
  onSelect,
}: {
  locale: Locale;
  dict: Dictionary["search"];
  results: SearchSuggestion[];
  total: number;
  loading: boolean;
  highlightedIndex: number;
  viewAllHref: string;
  onSelect: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      {results.length === 0 ? (
        <p className="px-4 py-4 text-sm text-zinc-500">
          {loading ? "…" : dict.noResultsLabel}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {results.map((result, index) => (
            <li key={result.id}>
              <Link
                href={`/${locale}/catalog/${result.slug}`}
                onClick={onSelect}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  index === highlightedIndex
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {result.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ProductVisual category={result.category} className="h-full w-full" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {result.name}
                  </span>
                  {result.productCode && (
                    <span className="text-xs text-zinc-400">{result.productCode}</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatGel(result.price, locale)}
                  </span>
                  {result.oldPrice && (
                    <span className="text-xs text-zinc-400 line-through">
                      {formatGel(result.oldPrice, locale)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > results.length && (
        <Link
          href={viewAllHref}
          onClick={onSelect}
          className="block border-t border-zinc-100 px-4 py-2.5 text-center text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 dark:border-zinc-800 dark:hover:bg-orange-950/40"
        >
          {dict.viewAllResultsPrefix} {total}
        </Link>
      )}
    </div>
  );
}

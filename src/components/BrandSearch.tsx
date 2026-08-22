"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionary";

type FilterFieldsState = {
  make: string;
  priceMin: string;
  priceMax: string;
  yearFrom: string;
  yearTo: string;
};

const EMPTY_FILTERS: FilterFieldsState = {
  make: "",
  priceMin: "",
  priceMax: "",
  yearFrom: "",
  yearTo: "",
};

function filtersFromSearchParams(searchParams: URLSearchParams): FilterFieldsState {
  return {
    make: searchParams.get("make") ?? "",
    priceMin: searchParams.get("priceMin") ?? "",
    priceMax: searchParams.get("priceMax") ?? "",
    yearFrom: searchParams.get("yearFrom") ?? "",
    yearTo: searchParams.get("yearTo") ?? "",
  };
}

/**
 * Search + filter widget scoped to a single brand's page (e.g. /ru/brands/elring).
 * Same icon-and-modal pattern as the site-wide HeaderSearch, minus the brand
 * selector — the brand is already fixed by the page itself.
 */
export default function BrandSearch({
  basePath,
  dict,
  carMakes,
}: {
  basePath: string;
  dict: Dictionary["search"];
  carMakes: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterFieldsState>(() => filtersFromSearchParams(searchParams));

  const searchParamsKey = searchParams.toString();
  const [lastQueryKey, setLastQueryKey] = useState(searchParamsKey);
  if (searchParamsKey !== lastQueryKey) {
    setLastQueryKey(searchParamsKey);
    setQuery(searchParams.get("q") ?? "");
  }

  const filtersSyncKey = `${searchParamsKey}|${filtersOpen}`;
  const [lastFiltersSyncKey, setLastFiltersSyncKey] = useState(filtersSyncKey);
  if (filtersSyncKey !== lastFiltersSyncKey) {
    setLastFiltersSyncKey(filtersSyncKey);
    setFilters(filtersFromSearchParams(searchParams));
  }

  function navigateWith(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    navigateWith({ q: query.trim() || undefined });
  }

  function handleFiltersApply(event: FormEvent) {
    event.preventDefault();
    navigateWith({
      make: filters.make || undefined,
      priceMin: filters.priceMin || undefined,
      priceMax: filters.priceMax || undefined,
      yearFrom: filters.yearFrom || undefined,
      yearTo: filters.yearTo || undefined,
    });
    setFiltersOpen(false);
  }

  function handleFiltersReset() {
    setFilters(EMPTY_FILTERS);
    navigateWith({
      make: undefined,
      priceMin: undefined,
      priceMax: undefined,
      yearFrom: undefined,
      yearTo: undefined,
    });
    setFiltersOpen(false);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex min-w-0 max-w-sm flex-1 items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            className="h-4 w-4 shrink-0 text-zinc-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dict.placeholder}
            aria-label={dict.ariaLabel}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          />
        </div>
        <button type="submit" className="sr-only">
          {dict.submitAriaLabel}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-label={dict.filtersAriaLabel}
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
          hasActiveFilters
            ? "border-orange-500 text-orange-600"
            : "border-zinc-200 text-zinc-700 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-200"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {hasActiveFilters && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-600" />
        )}
      </button>

      {filtersOpen &&
        createPortal(
          <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
            <div
              className="absolute inset-0"
              onClick={() => setFiltersOpen(false)}
              aria-hidden="true"
            />
            <form
              onSubmit={handleFiltersApply}
              className="relative flex w-full max-w-md flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {dict.filtersTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label={dict.closeFiltersAriaLabel}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    className="h-4 w-4"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {carMakes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {dict.makeLabel}
                  </span>
                  <select
                    value={filters.make}
                    onChange={(event) => setFilters((f) => ({ ...f, make: event.target.value }))}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    <option value="">{dict.allMakes}</option>
                    {carMakes.map((make) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {dict.yearLabel}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={dict.yearFrom}
                    value={filters.yearFrom}
                    onChange={(event) => setFilters((f) => ({ ...f, yearFrom: event.target.value }))}
                    className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <span className="text-zinc-400">—</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={dict.yearTo}
                    value={filters.yearTo}
                    onChange={(event) => setFilters((f) => ({ ...f, yearTo: event.target.value }))}
                    className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {dict.priceLabel}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={dict.priceFrom}
                    value={filters.priceMin}
                    onChange={(event) => setFilters((f) => ({ ...f, priceMin: event.target.value }))}
                    className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <span className="text-zinc-400">—</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={dict.priceTo}
                    value={filters.priceMax}
                    onChange={(event) => setFilters((f) => ({ ...f, priceMax: event.target.value }))}
                    className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleFiltersReset}
                  className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {dict.reset}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
                >
                  {dict.apply}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
}

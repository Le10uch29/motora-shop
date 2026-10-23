"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { savePromoListAction } from "./actions";
import { searchProductSuggestionsAction } from "@/lib/actions/search";
import { formatGel } from "@/lib/currency";
import { productImageUrl } from "@/lib/productImageUrl";
import { useConfirm } from "@/context/ConfirmContext";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export type PromoItem = {
  id: string;
  name: string;
  productCode: string | null;
  image: string | null;
  price: number;
  stock: number;
};

const SEARCH_DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 8;

/**
 * Одна подборка товаров главной: поиск сверху, ниже — сам список в порядке
 * показа, со стрелками «выше/ниже» и «убрать». Ничего не уходит на сервер,
 * пока не нажали «Сохранить» — так список можно спокойно перекроить целиком.
 */
export default function PromoListEditor({
  locale,
  dict,
  kind,
  title,
  limit,
  initialItems,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  kind: "popular" | "new";
  title: string;
  limit: number;
  initialItems: PromoItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [saved, setSaved] = useState(initialItems.map((item) => item.id).join(","));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const dirty = items.map((item) => item.id).join(",") !== saved;
  const full = items.length >= limit;

  // Гонка ответов при быстром наборе — показываем только ответ на последний запрос.
  const requestIdRef = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(
      () => {
        if (trimmed.length < MIN_QUERY_LENGTH) {
          setResults([]);
          return;
        }
        searchProductSuggestionsAction(locale, trimmed, undefined, SEARCH_LIMIT, 0).then((res) => {
          if (requestIdRef.current !== requestId) return;
          setResults(
            res.results.map((r) => ({
              id: r.id,
              name: r.name,
              productCode: r.productCode,
              image: r.image,
              price: r.price,
              stock: r.stock,
            }))
          );
        });
      },
      trimmed.length < MIN_QUERY_LENGTH ? 0 : SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [query, locale]);

  function add(item: PromoItem) {
    setJustSaved(false);
    setItems((prev) => (prev.some((p) => p.id === item.id) || prev.length >= limit ? prev : [...prev, item]));
  }

  function move(index: number, delta: number) {
    setJustSaved(false);
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function remove(item: PromoItem) {
    const ok = await confirm({
      message: `${dict.promoRemove}: ${title}?`,
      details: [item.productCode, item.name].filter(Boolean).join(" · "),
      confirmLabel: dict.promoRemove,
      irreversible: false,
    });
    if (!ok) return;
    setJustSaved(false);
    setItems((prev) => prev.filter((p) => p.id !== item.id));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await savePromoListAction(
        locale,
        kind,
        items.map((item) => item.id)
      );
      if (result.error) {
        setError(result.error === "too_many" ? dict.promoFull : result.error);
        return;
      }
      setSaved(items.map((item) => item.id).join(","));
      setJustSaved(true);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 sm:p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {title}{" "}
          <span className={`text-sm font-medium ${full ? "text-amber-600" : "text-zinc-400"}`}>
            {items.length}/{limit} {dict.promoLimitLabel}
          </span>
        </h2>
        <div className="flex items-center gap-3">
          {dirty ? (
            <span className="text-xs text-amber-600">{dict.promoUnsaved}</span>
          ) : (
            justSaved && <span className="text-xs text-emerald-600">{dict.promoSaved} ✓</span>
          )}
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={save}
            className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? dict.promoSaving : dict.promoSave}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder={dict.promoSearchPlaceholder}
          aria-label={dict.promoSearchPlaceholder}
          className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        {results.length > 0 && (
          <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {results.map((result) => {
              const inList = items.some((item) => item.id === result.id);
              return (
                <li key={result.id} className="flex items-center gap-3 px-3 py-2">
                  <Thumb image={result.image} />
                  <ProductText item={result} locale={locale} />
                  <button
                    type="button"
                    disabled={inList || full}
                    title={full && !inList ? dict.promoFull : undefined}
                    onClick={() => add(result)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                      inList
                        ? "bg-emerald-600 text-white"
                        : "bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50"
                    }`}
                  >
                    {inList ? `${dict.promoAdded} ✓` : dict.promoAdd}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {dict.promoEmpty}
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`flex items-center gap-3 px-3 py-2 ${item.stock <= 0 ? "opacity-60" : ""}`}
            >
              <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-400">
                {index + 1}
              </span>
              <Thumb image={item.image} />
              <ProductText item={item} locale={locale} />
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label={dict.promoMoveUp} disabled={index === 0} onClick={() => move(index, -1)}>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </IconButton>
                <IconButton
                  label={dict.promoMoveDown}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </IconButton>
                <IconButton label={dict.promoRemove} danger onClick={() => remove(item)}>
                  <path d="M6 6l12 12M18 6L6 18" />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Thumb({ image }: { image: string | null }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={productImageUrl(image, "thumb")} alt="" className="h-full w-full object-fill" loading="lazy" decoding="async" />
      ) : (
        <span className="text-xs text-zinc-400">—</span>
      )}
    </div>
  );
}

function ProductText({ item, locale }: { item: PromoItem; locale: Locale }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.name}</span>
      <span className="flex flex-wrap gap-x-2 text-xs text-zinc-400">
        {item.productCode && <span className="font-mono">{item.productCode}</span>}
        <span>{formatGel(item.price, locale)}</span>
        <span className={item.stock <= 0 ? "text-red-500" : ""}>· {item.stock}</span>
      </span>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? "border-red-200 text-red-600 hover:border-red-500 dark:border-red-900"
          : "border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        {children}
      </svg>
    </button>
  );
}

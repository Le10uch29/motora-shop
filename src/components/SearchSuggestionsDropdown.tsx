"use client";

import Link from "next/link";
import type { SearchSuggestion } from "@/lib/actions/search";
import { formatGel } from "@/lib/currency";
import ProductVisual from "@/components/ProductVisual";
import ProductCardAddToCart from "@/components/ProductCardAddToCart";
import { productImageUrl } from "@/lib/productImageUrl";
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
  // Высота ограничена со своей прокруткой: строка с количеством и кнопкой на
  // телефоне переносится на две строки, и шесть подсказок уезжали за нижний
  // край экрана — до последней приходилось скроллить всю страницу.
  //
  // На телефоне панель ещё и отвязана от ширины поля: в мобильной шапке поле
  // поиска шириной меньше 100px, и подсказки по его ширине не читались вовсе.
  // Поэтому там fixed во всю ширину экрана, под липкой шапкой (её высота
  // 73px). Элемент остаётся потомком формы, так что закрытие по клику мимо
  // (оно проверяет попадание клика внутрь формы) продолжает работать.
  return (
    <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.75rem] max-sm:mt-0 max-sm:max-h-[calc(100dvh-6rem)] dark:border-zinc-700 dark:bg-zinc-900">
      {results.length === 0 ? (
        <p className="px-4 py-4 text-sm text-zinc-500">
          {loading ? "…" : dict.noResultsLabel}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {results.map((result, index) => (
            <li
              key={result.id}
              // Строка больше не целиком ссылка: внутри живут кнопки
              // количества и «в корзину», а интерактивные элементы внутри
              // <a> — невалидная разметка, по которой браузеры расходятся.
              // Ссылкой осталась только левая часть (фото, название, код).
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-3 transition-colors sm:px-4 ${
                index === highlightedIndex
                  ? "bg-zinc-100 dark:bg-zinc-800"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <Link
                href={`/${locale}/catalog/${result.slug}`}
                onClick={onSelect}
                className="flex min-w-0 flex-1 basis-48 items-center gap-3"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  {result.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImageUrl(result.image, "thumb")} alt="" className="h-full w-full object-fill" loading="lazy" decoding="async" />
                  ) : (
                    <ProductVisual className="h-full w-full" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-zinc-900 sm:text-base dark:text-zinc-50">
                    {result.name}
                  </span>
                  {result.productCode && (
                    <span className="font-mono text-xs text-zinc-400">{result.productCode}</span>
                  )}
                  <span className="text-xs text-emerald-600 dark:text-emerald-500">
                    {dict.inStockLabel}
                  </span>
                </div>
              </Link>

              <div className="ml-auto flex shrink-0 items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-50">
                    {formatGel(result.price, locale)}
                  </span>
                  {result.oldPrice && (
                    <span className="text-xs text-zinc-400 line-through sm:text-sm">
                      {formatGel(result.oldPrice, locale)}
                    </span>
                  )}
                </div>
                {/* Та же плитка количества и кнопка, что на карточке товара в
                    каталоге — чтобы из поиска можно было заказать не заходя в
                    товар. Подсказка при этом не закрывается: клик остаётся
                    внутри формы поиска. */}
                <ProductCardAddToCart
                  productId={result.id}
                  stock={result.stock}
                  labels={{
                    addToCart: dict.addToCart,
                    added: dict.addedToCart,
                    quantityLabel: dict.quantityLabel,
                    quantityDecreaseAria: dict.quantityDecreaseAria,
                    quantityIncreaseAria: dict.quantityIncreaseAria,
                  }}
                />
              </div>
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

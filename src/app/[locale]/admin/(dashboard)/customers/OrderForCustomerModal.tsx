"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { placeOrderForCustomerAction } from "./actions";
import { addItemsToOrderAction } from "../orders/actions";
import { searchProductSuggestionsAction, type SearchSuggestion } from "@/lib/actions/search";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import QuantityField from "@/components/QuantityField";
import { formatGel } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/** Сколько позиций показывать на одной странице выдачи. Больше, чем в шапке
 * сайта: там список лишь ведёт в каталог, а здесь из него собирают заказ, и до
 * нужной позиции нужно уметь дойти — остальное доступно листанием. */
const SEARCH_PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

type CartLine = {
  productId: string;
  name: string;
  productCode: string | null;
  price: number;
  stock: number;
  quantity: number;
};

function errorText(code: string, dict: Dictionary["admin"]): string {
  if (code === "empty_cart") return dict.orderForCustomerEmptyCart;
  if (code === "customer_not_found") return dict.orderForCustomerNotFound;
  if (code === "products_not_found") return dict.orderForCustomerNoProducts;
  if (code === "order_already_shipped") return dict.orderAddItemsShipped;
  return code;
}

/**
 * Оформление заказа вместо покупателя, который не пользуется сайтом.
 *
 * Поиск здесь свой, а не общий с витриной: там он ведёт в каталог — по Enter и
 * по кнопке лупы. Внутри модалки уходить некуда, и такой переход выбросил бы
 * админа из наполовину собранной корзины, поэтому формы нет вовсе, Enter
 * перехвачен, а результаты показываются прямо под строкой поиска.
 */
export default function OrderForCustomerModal({
  locale,
  dict,
  customer,
  appendToOrder,
  onClose,
  onPlaced,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  customer: { id: string; name: string; phone: string; organizationName: string };
  /** Номер существующего заказа: товары дописываются в него, а не уходят
   * новым заказом — покупатель что-то забыл, пока заказ собирают. */
  appendToOrder?: number;
  onClose: () => void;
  /** Вызывается после успешного оформления — список заказов стоит перечитать. */
  onPlaced: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  /** Сколько всего совпадений нашлось — по нему считается листание. */
  const [found, setFound] = useState(0);
  const [page, setPage] = useState(0);
  /** Строка, которой отвечает текущая выдача. Пока она отстаёт от набранного,
   * показываем «ищем» — отдельный флаг для этого не нужен и только разъезжался
   * бы с результатами. */
  const [resultsFor, setResultsFor] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [placedNumber, setPlacedNumber] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEscapeKey(onClose);

  // Гонка ответов: при быстром наборе более ранний запрос может вернуться
  // позже свежего, и в списке окажется выдача по старой строке.
  const requestIdRef = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestIdRef.current;
    // Всё состояние меняется внутри таймера, а не в теле эффекта: синхронный
    // setState там вызывает лишний проход рендера (и справедливо ругается
    // линтер) — тем же приёмом сделаны подсказки поиска на витрине.
    const timer = setTimeout(
      () => {
        if (requestIdRef.current !== requestId) return;
        if (trimmed.length < MIN_QUERY_LENGTH) {
          setResults([]);
          setFound(0);
          setResultsFor(trimmed);
          return;
        }
        searchProductSuggestionsAction(
          locale,
          trimmed,
          undefined,
          SEARCH_PAGE_SIZE,
          page * SEARCH_PAGE_SIZE,
          true
        ).then((res) => {
          if (requestIdRef.current !== requestId) return;
          setResults(res.results);
          setFound(res.total);
          setResultsFor(trimmed);
        });
      },
      trimmed.length < MIN_QUERY_LENGTH ? 0 : SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [query, locale, page]);

  const addLine = useCallback((result: SearchSuggestion, quantity: number) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === result.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === result.id
            ? { ...line, quantity: Math.min(line.quantity + quantity, result.stock) }
            : line
        );
      }
      return [
        ...prev,
        {
          productId: result.id,
          name: result.name,
          productCode: result.productCode,
          price: result.price,
          stock: result.stock,
          quantity,
        },
      ];
    });
  }, []);

  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  function handlePlace() {
    setError(null);
    startTransition(async () => {
      const items = lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
      const result =
        appendToOrder !== undefined
          ? await addItemsToOrderAction(locale, appendToOrder, items)
          : await placeOrderForCustomerAction(locale, customer.id, items);
      if (result.error) {
        setError(errorText(result.error, dict));
        return;
      }
      setPlacedNumber(result.orderNumber);
      onPlaced();
    });
  }

  if (placedNumber !== null) {
    return createPortal(
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
        <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {appendToOrder !== undefined ? dict.orderAddItemsDoneTitle : dict.orderForCustomerDoneTitle}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {dict.orderForCustomerDoneText} №{placedNumber} — {customer.name}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            {dict.close}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 py-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      {/* Высота задана, а не ограничена: внутри три самостоятельные области —
          поиск, выдача и корзина. Раньше прокручивалась модалка целиком, и
          растущая корзина выдавливала поиск за верхний край: добавив несколько
          позиций, искать следующую было уже негде. */}
      <div className="relative flex h-[calc(100vh-3rem)] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {appendToOrder !== undefined
                ? `${dict.orderAddItemsTitle} №${appendToOrder}`
                : dict.orderForCustomerTitle}
            </h2>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {customer.name}
            </span>
            <span className="text-xs text-zinc-500">
              {[customer.organizationName, customer.phone].filter(Boolean).join(" · ")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Намеренно не <form>: отправлять некуда, а Enter внутри формы увёл бы
            со страницы вместе с недособранной корзиной. */}
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            // Новый запрос — снова с первой страницы.
            setPage(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder={dict.orderForCustomerSearchPlaceholder}
          aria-label={dict.orderForCustomerSearchPlaceholder}
          className="w-full shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />

        <div className="flex min-h-32 flex-1 flex-col divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              {dict.orderForCustomerSearchHint}
            </p>
          ) : resultsFor !== query.trim() ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">{dict.noResults}</p>
          ) : (
            results.map((result) => (
              <SearchResultRow
                key={result.id}
                dict={dict}
                locale={locale}
                result={result}
                onAdd={addLine}
                inCart={lines.find((line) => line.productId === result.id)?.quantity ?? 0}
              />
            ))
          )}
        </div>

        {found > SEARCH_PAGE_SIZE && (
          <div className="flex shrink-0 items-center justify-between gap-3 text-sm text-zinc-500">
            <span>
              {page * SEARCH_PAGE_SIZE + 1}–{Math.min((page + 1) * SEARCH_PAGE_SIZE, found)} / {found}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={dict.paginationPrevious}
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                className="rounded-full border border-zinc-200 px-3 py-1 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={dict.paginationNext}
                disabled={(page + 1) * SEARCH_PAGE_SIZE >= found}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-full border border-zinc-200 px-3 py-1 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
              >
                ›
              </button>
            </div>
          </div>
        )}

        <div className="flex max-h-[32vh] min-h-0 shrink-0 flex-col gap-2">
          <h3 className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {dict.orderForCustomerCartTitle} {lines.length > 0 && `· ${lines.length}`}
          </h3>
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              {dict.orderForCustomerEmptyCart}
            </p>
          ) : (
            <ul className="flex min-h-0 flex-col divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {lines.map((line) => (
                <li key={line.productId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 flex-1 basis-40 flex-col">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {line.name}
                    </span>
                    {line.productCode && (
                      <span className="font-mono text-xs text-zinc-400">{line.productCode}</span>
                    )}
                  </div>
                  <QuantityField
                    value={line.quantity}
                    max={line.stock}
                    onChange={(next) =>
                      setLines((prev) =>
                        prev.map((item) =>
                          item.productId === line.productId ? { ...item, quantity: next } : item
                        )
                      )
                    }
                    labels={{
                      decreaseAria: dict.quantityDecreaseAria,
                      increaseAria: dict.quantityIncreaseAria,
                      inputAria: dict.quantityLabel,
                    }}
                  />
                  <span className="w-24 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatGel(line.price * line.quantity, locale)}
                  </span>
                  <button
                    type="button"
                    aria-label={dict.actionDelete}
                    onClick={() =>
                      setLines((prev) => prev.filter((item) => item.productId !== line.productId))
                    }
                    className="text-zinc-400 transition-colors hover:text-red-600"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {dict.orderForCustomerTotal}{" "}
            <strong className="text-zinc-900 dark:text-zinc-50">{formatGel(total, locale)}</strong>
          </span>
          <button
            type="button"
            disabled={pending || lines.length === 0}
            onClick={handlePlace}
            className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? dict.orderForCustomerPlacing
              : appendToOrder !== undefined
                ? dict.orderAddItemsSubmit
                : dict.orderForCustomerSubmit}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Строка выдачи со своим счётчиком: количество выбирают до добавления, как на
 * карточке товара в каталоге. */
function SearchResultRow({
  dict,
  locale,
  result,
  onAdd,
  inCart,
}: {
  dict: Dictionary["admin"];
  locale: Locale;
  result: SearchSuggestion;
  onAdd: (result: SearchSuggestion, quantity: number) => void;
  /** Сколько этого товара уже в корзине заказа, 0 — если нет. */
  inCart: number;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {result.name}
        </span>
        <span className="flex flex-wrap gap-x-2 text-xs text-zinc-400">
          {result.productCode && <span className="font-mono">{result.productCode}</span>}
          <span>
            {dict.orderForCustomerInStock} {result.stock}
          </span>
        </span>
      </div>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {formatGel(result.price, locale)}
      </span>
      <QuantityField
        value={quantity}
        max={result.stock}
        onChange={setQuantity}
        variant="pill"
        labels={{
          decreaseAria: dict.quantityDecreaseAria,
          increaseAria: dict.quantityIncreaseAria,
          inputAria: dict.quantityLabel,
        }}
      />
      {/* Надпись показывает состояние корзины, а не факт нажатия: прежняя
          метка гасла через секунду, и по списку было не понять, что уже
          добавлено. Нажать ещё раз по-прежнему можно — количество прибавится. */}
      <button
        type="button"
        onClick={() => onAdd(result, quantity)}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          inCart > 0
            ? "bg-emerald-600 text-white hover:bg-emerald-500"
            : "bg-orange-600 text-white hover:bg-orange-500"
        }`}
      >
        {inCart > 0 ? `${dict.orderForCustomerAdded} · ${inCart}` : dict.orderForCustomerAdd}
      </button>
    </div>
  );
}

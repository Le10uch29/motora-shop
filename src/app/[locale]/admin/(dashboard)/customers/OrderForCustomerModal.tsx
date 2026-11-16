"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { placeOrderForCustomerAction } from "./actions";
import {
  getOrderCatalogBrandsAction,
  getOrderCatalogPageAction,
  type OrderCatalogBrand,
  type OrderCatalogCard,
} from "./orderCatalogActions";
import { addItemsToOrderAction } from "../orders/actions";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import QuantityField from "@/components/QuantityField";
import BrandLogo from "@/components/BrandLogo";
import ProductVisual from "@/components/ProductVisual";
import SiteLogo from "@/components/SiteLogo";
import { formatGel } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

const SEARCH_DEBOUNCE_MS = 280;

type CartLine = {
  productId: string;
  name: string;
  productCode: string | null;
  image: string | null;
  price: number;
  stock: number;
  quantity: number;
};

function errorText(code: string, dict: Dictionary["admin"]): string {
  if (code === "empty_cart") return dict.orderForCustomerEmptyCart;
  if (code === "customer_not_found") return dict.orderForCustomerNotFound;
  if (code === "products_not_found") return dict.orderForCustomerNoProducts;
  if (code === "order_already_shipped") return dict.orderAddItemsShipped;
  if (code === "insufficient_stock") return dict.insufficientStock;
  return code;
}

/**
 * Оформление заказа вместо покупателя — на весь экран, в виде каталога сайта:
 * строка поиска, бренды, карточки товаров. Корзина заказа — кнопка в шапке,
 * она открывает отдельное окно со списком и оформлением.
 *
 * Поиск здесь не уводит со страницы, как на сайте (там Enter ведёт в каталог):
 * выдача обновляется прямо в сетке, иначе сотрудник потерял бы наполовину
 * собранную корзину. Поэтому формы нет вовсе, Enter перехвачен.
 *
 * Тем же окном дописывают товары в существующий заказ (appendToOrder).
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
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  const [brands, setBrands] = useState<OrderCatalogBrand[]>([]);
  const [items, setItems] = useState<OrderCatalogCard[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  /** Для каких фильтров загружена текущая сетка. Пока он отстаёт от
   * выбранных, сетка показана полупрозрачной — отдельный флаг «грузим»
   * разъезжался бы с результатами. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedNumber, setPlacedNumber] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => (cartOpen ? setCartOpen(false) : onClose()));

  // Страница под окном не должна прокручиваться колесом сквозь него.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getOrderCatalogBrandsAction(locale).then((result) => {
      if (alive) setBrands(result);
    });
    return () => {
      alive = false;
    };
  }, [locale]);

  const trimmedQuery = query.trim();
  const currentKey = `${trimmedQuery}|${brand}|${page}`;

  // Гонка ответов: при быстром наборе более ранний запрос может вернуться
  // позже свежего, и в сетке окажется выдача по старой строке.
  const requestIdRef = useRef(0);
  const lastQueryRef = useRef(trimmedQuery);
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    // Набор текста — с задержкой, бренд и страница — сразу.
    const typing = lastQueryRef.current !== trimmedQuery;
    lastQueryRef.current = trimmedQuery;
    const timer = setTimeout(
      () => {
        getOrderCatalogPageAction(locale, { query: trimmedQuery, brand }, page).then((result) => {
          if (requestIdRef.current !== requestId) return;
          setItems(result.items);
          setTotal(result.total);
          setPageSize(result.pageSize);
          setLoadedKey(`${trimmedQuery}|${brand}|${page}`);
        });
      },
      typing ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => clearTimeout(timer);
  }, [trimmedQuery, brand, page, locale]);

  const addLine = useCallback((card: OrderCatalogCard, quantity: number) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === card.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === card.id
            ? { ...line, quantity: Math.min(line.quantity + quantity, card.stock) }
            : line
        );
      }
      return [
        ...prev,
        {
          productId: card.id,
          name: card.name,
          productCode: card.productCode,
          image: card.image,
          price: card.price,
          stock: card.stock,
          quantity: Math.min(quantity, card.stock),
        },
      ];
    });
  }, []);

  function goToPage(next: number) {
    setPage(next);
    gridRef.current?.scrollTo({ top: 0 });
  }

  const cartTotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const cartUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const loading = loadedKey !== currentKey;

  function handlePlace() {
    setError(null);
    startTransition(async () => {
      const payload = lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
      const result =
        appendToOrder !== undefined
          ? await addItemsToOrderAction(locale, appendToOrder, payload)
          : await placeOrderForCustomerAction(locale, customer.id, payload);
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
      <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dict.orderForCustomerTitle}
      className="fixed inset-0 z-[70] flex flex-col bg-zinc-50 dark:bg-zinc-950"
    >
      {/* Шапка: кто заказывает, поиск, корзина, закрыть. На телефоне поиск
          уходит отдельной строкой под заголовок. */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:flex-nowrap sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Логотип — как в шапке сайта и админки: окно на весь экран
            закрывает их, и без него оно выглядело бы чужой страницей. */}
        <div className="flex shrink-0 items-center">
          <SiteLogo className="h-10 sm:h-12" sizes="100px" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col sm:max-w-xs sm:flex-none">
          <h2 className="truncate text-base font-bold text-zinc-900 dark:text-zinc-50">
            {appendToOrder !== undefined
              ? `${dict.orderAddItemsTitle} №${appendToOrder}`
              : dict.orderForCustomerTitle}
          </h2>
          <span className="truncate text-xs text-zinc-500">
            {[customer.name, customer.organizationName, customer.phone].filter(Boolean).join(" · ")}
          </span>
        </div>

        <div className="order-last flex w-full min-w-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 focus-within:border-orange-500 sm:order-none sm:mx-auto sm:max-w-2xl sm:flex-1 dark:border-zinc-700 dark:bg-zinc-950">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            className="h-4 w-4 shrink-0 text-zinc-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          {/* Намеренно не <form>: отправлять некуда, а Enter внутри формы увёл
              бы со страницы вместе с недособранной корзиной. */}
          <input
            type="search"
            value={query}
            autoFocus
            onChange={(event) => {
              setQuery(event.target.value);
              // Новый запрос — снова с первой страницы.
              setPage(1);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder={dict.orderForCustomerSearchPlaceholder}
            aria-label={dict.orderForCustomerSearchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          />
        </div>

        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={dict.orderForCustomerOpenCart}
          title={dict.orderForCustomerOpenCart}
          className="relative flex shrink-0 items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <circle cx="9" cy="20" r="1.3" />
            <circle cx="17" cy="20" r="1.3" />
            <path d="M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L20 8H6" />
          </svg>
          <span className="hidden md:inline">{formatGel(cartTotal, locale)}</span>
          {lines.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-[11px] font-bold text-white dark:bg-white dark:text-zinc-900">
              {cartUnits}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label={dict.close}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {/* Бренды — лентой, как переключатель: «Все бренды» и по одному. */}
      <nav
        aria-label={dict.brandFilterAll}
        className="flex shrink-0 gap-2 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2.5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <BrandChip
          active={brand === ""}
          onClick={() => {
            setBrand("");
            goToPage(1);
          }}
        >
          {dict.brandFilterAll}
        </BrandChip>
        {brands.map((item) => (
          <BrandChip
            key={item.slug}
            active={brand === item.slug}
            onClick={() => {
              setBrand(item.slug);
              goToPage(1);
            }}
          >
            {item.badgeLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.badgeLogoUrl} alt="" className="h-4 w-auto max-w-10 object-contain" />
            )}
            {item.name}
          </BrandChip>
        ))}
      </nav>

      <div ref={gridRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-[120rem] flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {dict.orderForCustomerFound} <strong className="text-zinc-900 dark:text-zinc-50">{total}</strong>
          </p>

          {loadedKey === null ? (
            <p className="py-16 text-center text-sm text-zinc-500">…</p>
          ) : items.length === 0 && !loading ? (
            <p className="py-16 text-center text-sm text-zinc-500">{dict.orderForCustomerCatalogEmpty}</p>
          ) : (
            <div
              className={`grid grid-cols-2 gap-3 transition-opacity sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 ${
                loading ? "opacity-50" : ""
              }`}
            >
              {items.map((card) => (
                <CatalogCard
                  key={card.id}
                  card={card}
                  dict={dict}
                  locale={locale}
                  inCart={lines.find((line) => line.productId === card.id)?.quantity ?? 0}
                  onAdd={addLine}
                />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
              <button
                type="button"
                aria-label={dict.paginationPrevious}
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="rounded-full border border-zinc-200 px-4 py-1.5 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
              >
                ‹
              </button>
              <span>
                {page} / {pageCount}
              </span>
              <button
                type="button"
                aria-label={dict.paginationNext}
                disabled={page >= pageCount}
                onClick={() => goToPage(page + 1)}
                className="rounded-full border border-zinc-200 px-4 py-1.5 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 sm:py-12">
          <div className="absolute inset-0" onClick={() => setCartOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dict.orderForCustomerCartTitle}
            className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col gap-4 rounded-2xl bg-white p-5 shadow-xl sm:max-h-[calc(100vh-6rem)] sm:p-6 dark:bg-zinc-900"
          >
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {dict.orderForCustomerCartTitle} {lines.length > 0 && `· ${lines.length}`}
                </h3>
                <span className="text-xs text-zinc-500">{customer.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label={dict.close}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
                {dict.orderForCustomerEmptyCart}
              </p>
            ) : (
              <ul className="flex min-h-0 flex-col divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {lines.map((line) => (
                  <li key={line.productId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <ProductVisual className="h-12 w-12 shrink-0 rounded-lg" />
                    )}
                    <div className="flex min-w-0 flex-1 basis-40 flex-col">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {line.name}
                      </span>
                      <span className="flex flex-wrap gap-x-2 text-xs text-zinc-400">
                        {line.productCode && <span className="font-mono">{line.productCode}</span>}
                        <span>{formatGel(line.price, locale)}</span>
                      </span>
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {dict.orderForCustomerTotal}{" "}
                <strong className="text-base text-zinc-900 dark:text-zinc-50">{formatGel(cartTotal, locale)}</strong>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {dict.orderForCustomerContinue}
                </button>
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
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function BrandChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-orange-600 bg-orange-600 text-white"
          : "border-zinc-200 text-zinc-700 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

/** Карточка как в каталоге сайта, только вместо корзины покупателя — корзина
 * этого заказа. Количество выбирают до добавления, как на сайте. */
function CatalogCard({
  card,
  dict,
  locale,
  inCart,
  onAdd,
}: {
  card: OrderCatalogCard;
  dict: Dictionary["admin"];
  locale: Locale;
  /** Сколько этого товара уже в корзине заказа, 0 — если нет. */
  inCart: number;
  onAdd: (card: OrderCatalogCard, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const soldOut = card.stock <= 0;
  const remaining = Math.max(0, card.stock - inCart);
  const percent =
    card.oldPrice && card.oldPrice > card.price
      ? Math.round(((card.oldPrice - card.price) / card.oldPrice) * 100)
      : undefined;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900 ${
        soldOut ? "select-none opacity-60 grayscale" : ""
      }`}
    >
      <div className="relative">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt={card.name} className="aspect-[4/3] w-full object-fill" loading="lazy" decoding="async" />
        ) : (
          <ProductVisual className="aspect-[4/3] w-full" />
        )}
        {(card.brandBadge || card.brandName) && (
          <BrandLogo logoUrl={card.brandBadge} name={card.brandName ?? ""} className="absolute left-2 top-2" />
        )}
        {soldOut && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-md border-2 border-red-600 bg-white/90 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-red-600 dark:bg-zinc-900/90">
            {dict.orderForCustomerSoldOut}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 pb-0">
        {(card.originCode || card.productCode) && (
          <div className="flex flex-col text-sm">
            {card.originCode && (
              <span className="truncate font-semibold text-zinc-900 dark:text-zinc-50">OEM: {card.originCode}</span>
            )}
            {card.productCode && (
              <span className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{card.productCode}</span>
            )}
          </div>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{card.name}</h3>
        {card.vehicles && <p className="line-clamp-2 text-xs text-zinc-500">{card.vehicles}</p>}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
          <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">{formatGel(card.price, locale)}</span>
          {card.oldPrice && (
            <span className="text-xs text-zinc-400 line-through">{formatGel(card.oldPrice, locale)}</span>
          )}
          {percent !== undefined && (
            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">−{percent}%</span>
          )}
        </div>
        {!soldOut && (
          <span className="text-xs text-zinc-500">
            {dict.orderForCustomerInStock} {card.stock}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        {soldOut ? (
          <span className="block rounded-full bg-zinc-100 px-3 py-1.5 text-center text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {dict.orderForCustomerSoldOut}
          </span>
        ) : (
          <>
            <QuantityField
              value={Math.min(quantity, Math.max(remaining, 1))}
              max={Math.max(remaining, 1)}
              onChange={setQuantity}
              variant="pill"
              labels={{
                decreaseAria: dict.quantityDecreaseAria,
                increaseAria: dict.quantityIncreaseAria,
                inputAria: dict.quantityLabel,
              }}
            />
            {/* Надпись показывает состояние корзины, а не факт нажатия: по
                сетке сразу видно, что уже добавлено. Нажать ещё раз можно —
                количество прибавится, пока хватает остатка. */}
            <button
              type="button"
              disabled={remaining === 0}
              onClick={() => onAdd(card, Math.min(quantity, remaining))}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                inCart > 0 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-orange-600 hover:bg-orange-500"
              }`}
            >
              {inCart > 0 ? `${dict.orderForCustomerAdded} · ${inCart}` : dict.orderForCustomerAdd}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

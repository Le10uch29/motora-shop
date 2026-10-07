"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  // Whether the current cart contents were just submitted as an order.
  // Reset to false any time the cart itself changes.
  orderPlaced: boolean;
};

type CartContextValue = {
  items: CartItem[];
  orderPlaced: boolean;
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  markOrdered: () => void;
  totalItems: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const EMPTY_STATE: CartState = { items: [], orderPlaced: false };

// Keyed per logged-in user so one browser can't leak an admin's test cart
// into a customer's session (or vice versa) after switching accounts.
function storageKeyFor(userId: string | null): string {
  return `araz-motors-cart:${userId ?? "anon"}`;
}

/* ------------------------------------------------------------------------ *
 * Корзина как внешнее хранилище.
 *
 * Она живёт в localStorage, а не в React, и подписка на неё сделана через
 * useSyncExternalStore — штатный для этого случая API. Раньше чтение стояло в
 * useEffect с setState внутри: React рисовал провайдер с пустой корзиной,
 * эффект срабатывал и тут же вызывал второй проход. Кроме лишнего прохода это
 * давало и настоящую ловушку — при смене аккаунта состояние предыдущего
 * пользователя успевало записаться в ключ нового, и от неё приходилось
 * защищаться отдельным флагом hydratedKey.
 *
 * Здесь состояние не хранится дважды: оно выводится из localStorage по ключу,
 * поэтому у чужого ключа нечему протечь, а запись в хранилище происходит
 * только при настоящем изменении.
 * ------------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Подписка на изменения. Событие `storage` браузер шлёт только в *другие*
 * вкладки, поэтому оно даёт синхронизацию между ними, а свои изменения
 * рассылает emit() после записи. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", emit);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", emit);
  };
}

function parseState(raw: string | null): CartState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw);
    // Старые сохранённые корзины были просто массивом позиций — до того, как
    // появился orderPlaced.
    const items: unknown = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(items)) return EMPTY_STATE;
    // Хранилище правит кто угодно через консоль браузера, поэтому форму строк
    // проверяем, а не принимаем на веру.
    const clean = items.filter(
      (item): item is CartItem =>
        typeof item?.productId === "string" && Number.isFinite(item?.quantity) && item.quantity > 0
    );
    return { items: clean, orderPlaced: Array.isArray(parsed) ? false : Boolean(parsed?.orderPlaced) };
  } catch {
    return EMPTY_STATE;
  }
}

// useSyncExternalStore сравнивает снимки по ссылке и зациклится, если каждый
// раз отдавать новый объект. Поэтому разобранное значение кэшируется, пока в
// хранилище лежит ровно та же строка.
let cachedKey: string | null = null;
let cachedRaw: string | null = null;
let cachedState: CartState = EMPTY_STATE;

function readState(storageKey: string): CartState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    // Приватный режим или запрет на хранилище — корзина просто не переживёт
    // перезагрузку, но работать не перестанет.
    raw = null;
  }
  if (storageKey === cachedKey && raw === cachedRaw) return cachedState;
  cachedKey = storageKey;
  cachedRaw = raw;
  cachedState = parseState(raw);
  return cachedState;
}

function writeState(storageKey: string, next: CartState) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(storageKey, raw);
  } catch {
    // Записать не вышло — корзина всё равно обновится в этой вкладке.
  }
  cachedKey = storageKey;
  cachedRaw = raw;
  cachedState = next;
  emit();
}

/** Снимок для сервера: там localStorage нет, и корзина у любого посетителя
 * одинаково пустая. Ссылка постоянная — этого требует useSyncExternalStore. */
function getServerState(): CartState {
  return EMPTY_STATE;
}

export function CartProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const storageKey = storageKeyFor(userId);
  const getState = useCallback(() => readState(storageKey), [storageKey]);
  const state = useSyncExternalStore(subscribe, getState, getServerState);

  const update = useCallback(
    (recipe: (prev: CartState) => CartState) => {
      // Исходное состояние читается из хранилища, а не из замыкания: соседняя
      // вкладка могла изменить корзину уже после этого рендера.
      writeState(storageKey, recipe(readState(storageKey)));
    },
    [storageKey]
  );

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      update((prev) => {
        // После оформленного заказа корзина начинается заново. Позиции в ней
        // остаются только ради экрана подтверждения; без этого сброса
        // следующая покупка уехала бы вместе с уже заказанным — то есть
        // отправилась бы вторым таким же заказом.
        if (prev.orderPlaced) return { items: [{ productId, quantity }], orderPlaced: false };

        const existing = prev.items.find((item) => item.productId === productId);
        const items = existing
          ? prev.items.map((item) =>
              item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item
            )
          : [...prev.items, { productId, quantity }];
        return { items, orderPlaced: false };
      });
    },
    [update]
  );

  const removeItem = useCallback(
    (productId: string) => {
      update((prev) => ({
        items: prev.items.filter((item) => item.productId !== productId),
        orderPlaced: false,
      }));
    },
    [update]
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      update((prev) => ({
        items:
          quantity <= 0
            ? prev.items.filter((item) => item.productId !== productId)
            : prev.items.map((item) =>
                item.productId === productId ? { ...item, quantity } : item
              ),
        orderPlaced: false,
      }));
    },
    [update]
  );

  const clear = useCallback(() => update(() => EMPTY_STATE), [update]);

  const markOrdered = useCallback(() => {
    update((prev) => ({ ...prev, orderPlaced: true }));
  }, [update]);

  // Count of distinct products in the cart, not the sum of their quantities
  // (30 units of one part should show as 1, not 30).
  const totalItems = state.items.length;

  const value = useMemo(
    () => ({
      items: state.items,
      orderPlaced: state.orderPlaced,
      addItem,
      removeItem,
      setQuantity,
      clear,
      markOrdered,
      totalItems,
    }),
    [state, addItem, removeItem, setQuantity, clear, markOrdered, totalItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

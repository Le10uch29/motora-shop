"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearCartAction,
  getCartAction,
  importLocalCartAction,
  removeOrderedCartItemAction,
  setCartItemAction,
  type CartItem,
  type CartSnapshot,
  type OrderedCartItem,
} from "@/lib/actions/cart";

export type { CartItem, OrderedCartItem };

type CartContextValue = {
  /** Что лежит в корзине и уйдёт в следующий заказ. */
  items: CartItem[];
  /** Уже заказанное — остаётся в корзине 3 дня, потом удаляется само. */
  ordered: OrderedCartItem[];
  /** Корзина уже пришла с сервера (до этого она пустая не потому, что пустая). */
  loaded: boolean;
  /** Заказ только что оформлен — до следующего изменения корзины. */
  orderPlaced: boolean;
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeOrdered: (id: string) => void;
  clear: () => void;
  /** Вызывается после успешного оформления: перечитывает корзину. */
  markOrdered: () => void;
  totalItems: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const EMPTY: CartSnapshot = { items: [], ordered: [] };

/** Ключ, под которым корзина лежала в localStorage до переезда на сервер. */
function legacyStorageKey(userId: string): string {
  return `araz-motors-cart:${userId}`;
}

function readLegacyCart(userId: string): CartItem[] {
  try {
    const raw = window.localStorage.getItem(legacyStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items: unknown = Array.isArray(parsed) ? parsed : parsed?.items;
    // Заказанная тогда корзина (orderPlaced) переносить не нужно — она уже заказ.
    if (!Array.isArray(items) || (!Array.isArray(parsed) && parsed?.orderPlaced)) return [];
    return items.filter(
      (item): item is CartItem =>
        typeof item?.productId === "string" && Number.isFinite(item?.quantity) && item.quantity > 0
    );
  } catch {
    return [];
  }
}

/**
 * Корзина пользователя. Хранится на сервере (таблица cart_items), поэтому
 * одна и та же — в любом браузере и на любом устройстве, где он вошёл.
 *
 * Изменения показываются сразу (не дожидаясь ответа), а на сервер уходят по
 * очереди, одно за другим: иначе быстрые нажатия «+» могли бы прийти в
 * другом порядке и оставить не то количество. Если сервер ответил ошибкой,
 * корзина перечитывается и показывает то, что там на самом деле.
 *
 * Корзина перечитывается и при возвращении на вкладку — так видно, что
 * поменяли на другом устройстве.
 */
export function CartProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<CartSnapshot>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Растёт с каждым локальным изменением: перечитанная корзина, запрошенная
   * до него, уже устарела и не должна затирать то, что человек только что
   * сделал. */
  const versionRef = useRef(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    const version = versionRef.current;
    getCartAction()
      .then((next) => {
        if (versionRef.current !== version) return;
        setSnapshot(next);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  const enqueue = useCallback(
    (run: () => Promise<{ error: string | null }>) => {
      versionRef.current++;
      queueRef.current = queueRef.current
        .then(run)
        .then((result) => {
          if (result.error) refresh();
        })
        .catch(() => refresh());
    },
    [refresh]
  );

  // Первая загрузка: перенос старой корзины из localStorage (один раз) и
  // чтение корзины с сервера.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const legacy = readLegacyCart(userId);
    const start = legacy.length > 0 ? importLocalCartAction(legacy) : Promise.resolve({ error: null });
    start
      .then((result) => {
        if (!result.error) {
          try {
            window.localStorage.removeItem(legacyStorageKey(userId));
          } catch {
            // Не удалилось — при следующем заходе просто ничего не добавится сверху.
          }
        }
      })
      .finally(() => {
        if (!cancelled) refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  // Вернулись на вкладку — корзину могли поменять на другом устройстве.
  useEffect(() => {
    if (!userId) return;
    function handleVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [userId, refresh]);

  const changeItems = useCallback((recipe: (items: CartItem[]) => CartItem[]) => {
    setOrderPlaced(false);
    setSnapshot((prev) => ({ ...prev, items: recipe(prev.items) }));
  }, []);

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      changeItems((items) =>
        items.some((item) => item.productId === productId)
          ? items.map((item) =>
              item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item
            )
          : [...items, { productId, quantity }]
      );
      enqueue(() => setCartItemAction(productId, quantity, true));
    },
    [changeItems, enqueue]
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      changeItems((items) =>
        quantity <= 0
          ? items.filter((item) => item.productId !== productId)
          : items.map((item) => (item.productId === productId ? { ...item, quantity } : item))
      );
      enqueue(() => setCartItemAction(productId, quantity));
    },
    [changeItems, enqueue]
  );

  const removeItem = useCallback(
    (productId: string) => {
      changeItems((items) => items.filter((item) => item.productId !== productId));
      enqueue(() => setCartItemAction(productId, 0));
    },
    [changeItems, enqueue]
  );

  const clear = useCallback(() => {
    changeItems(() => []);
    enqueue(() => clearCartAction());
  }, [changeItems, enqueue]);

  const removeOrdered = useCallback(
    (id: string) => {
      setSnapshot((prev) => ({ ...prev, ordered: prev.ordered.filter((item) => item.id !== id) }));
      enqueue(() => removeOrderedCartItemAction(id));
    },
    [enqueue]
  );

  const markOrdered = useCallback(() => {
    setOrderPlaced(true);
    refresh();
  }, [refresh]);

  // Count of distinct products in the cart, not the sum of their quantities
  // (30 units of one part should show as 1, not 30).
  const totalItems = snapshot.items.length;

  const value = useMemo(
    () => ({
      items: snapshot.items,
      ordered: snapshot.ordered,
      loaded,
      orderPlaced,
      addItem,
      removeItem,
      setQuantity,
      removeOrdered,
      clear,
      markOrdered,
      totalItems,
    }),
    [snapshot, loaded, orderPlaced, addItem, removeItem, setQuantity, removeOrdered, clear, markOrdered, totalItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

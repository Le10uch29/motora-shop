"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

export function CartProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const storageKey = storageKeyFor(userId);
  const [state, setState] = useState<CartState>(EMPTY_STATE);
  // Which storageKey `state` currently reflects — guards the persist effect
  // from writing a still-stale (previous user's) `state` into the new key
  // during the render where `storageKey` just changed but the read effect
  // below hasn't run yet.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Older stored carts were a plain CartItem[] before orderPlaced existed.
        setState(Array.isArray(parsed) ? { items: parsed, orderPlaced: false } : parsed);
      } else {
        setState(EMPTY_STATE);
      }
    } catch {
      setState(EMPTY_STATE);
    }
    setHydratedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (hydratedKey !== storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey, hydratedKey]);

  const addItem = useCallback((productId: string, quantity = 1) => {
    setState((prev) => {
      const existing = prev.items.find((item) => item.productId === productId);
      const items = existing
        ? prev.items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        : [...prev.items, { productId, quantity }];
      return { items, orderPlaced: false };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setState((prev) => ({
      items: prev.items.filter((item) => item.productId !== productId),
      orderPlaced: false,
    }));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setState((prev) => {
      const items =
        quantity <= 0
          ? prev.items.filter((item) => item.productId !== productId)
          : prev.items.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            );
      return { items, orderPlaced: false };
    });
  }, []);

  const clear = useCallback(() => setState(EMPTY_STATE), []);

  const markOrdered = useCallback(() => {
    setState((prev) => ({ ...prev, orderPlaced: true }));
  }, []);

  const totalItems = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items]
  );

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

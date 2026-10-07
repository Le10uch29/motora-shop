"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import QuantityField from "@/components/QuantityField";

// Only the plain strings the buttons need — never the whole Dictionary["product"]
// object, which also carries a stockCount() function that can't cross the
// server->client boundary as a prop.
type Labels = {
  addToCart: string;
  added: string;
  quantityLabel: string;
  quantityDecreaseAria: string;
  quantityIncreaseAria: string;
};

export default function ProductCardAddToCart({
  productId,
  stock,
  labels,
}: {
  productId: string;
  stock: number;
  labels: Labels;
}) {
  const { addItem, items, orderPlaced } = useCart();
  const [quantity, setQuantity] = useState(1);
  const maxQuantity = Math.max(stock, 1);

  // Галочка отражает корзину, а не факт нажатия. Оформленный заказ считается
  // пустой корзиной: позиции в ней остаются только ради экрана подтверждения,
  // и товар снова можно добавить. Убрали товар из корзины — галочка пропадёт
  // сама, состояние тут не хранится.
  const inCart = orderPlaced ? 0 : items.find((item) => item.productId === productId)?.quantity ?? 0;

  return (
    <div className="flex items-center gap-2">
      <QuantityField
        value={quantity}
        onChange={setQuantity}
        max={maxQuantity}
        variant="pill"
        labels={{
          decreaseAria: labels.quantityDecreaseAria,
          increaseAria: labels.quantityIncreaseAria,
          inputAria: labels.quantityLabel,
        }}
      />
      <button
        type="button"
        onClick={() => addItem(productId, quantity)}
        title={inCart > 0 ? `${labels.added} · ${inCart}` : labels.addToCart}
        aria-label={inCart > 0 ? `${labels.added} · ${inCart}` : labels.addToCart}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-colors ${
          inCart > 0 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-orange-600 hover:bg-orange-500"
        }`}
      >
        {inCart > 0 ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <circle cx="9" cy="20" r="1.3" />
            <circle cx="17" cy="20" r="1.3" />
            <path d="M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L20 8H6" />
          </svg>
        )}
      </button>
    </div>
  );
}

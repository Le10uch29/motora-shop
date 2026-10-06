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
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const maxQuantity = Math.max(stock, 1);
  // Надпись отражает корзину, а не факт нажатия: прежняя метка «Добавлено»
  // гасла через секунду, и по списку товаров было не видно, что уже взято.
  const inCart = items.find((item) => item.productId === productId)?.quantity ?? 0;

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
        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
          inCart > 0 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-orange-600 hover:bg-orange-500"
        }`}
      >
        {inCart > 0 ? `${labels.added} · ${inCart}` : labels.addToCart}
      </button>
    </div>
  );
}

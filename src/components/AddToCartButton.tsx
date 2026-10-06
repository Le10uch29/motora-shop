"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import QuantityField from "@/components/QuantityField";

export default function AddToCartButton({
  productId,
  inStock,
  stock,
  labels,
}: {
  productId: string;
  inStock: boolean;
  stock: number;
  labels: {
    addToCart: string;
    onOrder: string;
    added: string;
    quantityLabel: string;
    quantityDecreaseAria: string;
    quantityIncreaseAria: string;
  };
}) {
  const { addItem, items } = useCart();
  const maxQuantity = inStock ? Math.max(stock, 1) : 99;
  const inCart = items.find((item) => item.productId === productId)?.quantity ?? 0;
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{labels.quantityLabel}</span>
        <QuantityField
          value={quantity}
          onChange={setQuantity}
          max={maxQuantity}
          labels={{
            decreaseAria: labels.quantityDecreaseAria,
            increaseAria: labels.quantityIncreaseAria,
            inputAria: labels.quantityLabel,
          }}
        />
      </div>

      <button
        type="button"
        disabled={!inStock}
        onClick={() => addItem(productId, quantity)}
        className={`w-fit rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 ${
          inCart > 0 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-orange-600 hover:bg-orange-500"
        }`}
      >
        {!inStock ? labels.onOrder : inCart > 0 ? `${labels.added} · ${inCart}` : labels.addToCart}
      </button>
    </div>
  );
}

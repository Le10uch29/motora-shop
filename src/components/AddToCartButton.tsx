"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";

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
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const maxQuantity = inStock ? Math.max(stock, 1) : 99;
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{labels.quantityLabel}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={labels.quantityDecreaseAria}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            −
          </button>
          <span className="w-6 text-center font-medium text-zinc-900 dark:text-zinc-50">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={labels.quantityIncreaseAria}
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            disabled={quantity >= maxQuantity}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={!inStock}
        onClick={() => {
          addItem(productId, quantity);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
        className="w-fit rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {!inStock ? labels.onOrder : added ? labels.added : labels.addToCart}
      </button>
    </div>
  );
}

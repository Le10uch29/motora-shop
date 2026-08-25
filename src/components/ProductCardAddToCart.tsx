"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";

// Only the plain strings the buttons need — never the whole Dictionary["product"]
// object, which also carries a stockCount() function that can't cross the
// server->client boundary as a prop.
type Labels = {
  addToCart: string;
  added: string;
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
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const maxQuantity = Math.max(stock, 1);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          aria-label={labels.quantityDecreaseAria}
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {quantity}
        </span>
        <button
          type="button"
          aria-label={labels.quantityIncreaseAria}
          onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          disabled={quantity >= maxQuantity}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          addItem(productId, quantity);
          setAdded(true);
          setTimeout(() => setAdded(false), 1200);
        }}
        className="flex-1 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-500"
      >
        {added ? labels.added : labels.addToCart}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";

export default function AddToCartButton({
  productId,
  inStock,
  labels,
}: {
  productId: string;
  inStock: boolean;
  labels: { addToCart: string; onOrder: string; added: string };
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      disabled={!inStock}
      onClick={() => {
        addItem(productId);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className="rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
    >
      {!inStock ? labels.onOrder : added ? labels.added : labels.addToCart}
    </button>
  );
}

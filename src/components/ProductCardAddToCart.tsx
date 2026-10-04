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
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const maxQuantity = Math.max(stock, 1);

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

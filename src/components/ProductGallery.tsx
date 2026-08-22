"use client";

import { useState, type ReactNode } from "react";
import type { CategoryId } from "@/lib/products";
import ProductVisual from "@/components/ProductVisual";

const MAX_PHOTOS = 4;

export default function ProductGallery({
  images,
  category,
  alt,
  overlay,
}: {
  images: string[] | undefined;
  category: CategoryId;
  alt: string;
  overlay?: ReactNode;
}) {
  const photos = (images ?? []).slice(0, MAX_PHOTOS);
  const [selected, setSelected] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl">
        <ProductVisual category={category} className="aspect-square w-full" />
        {overlay}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[selected] ?? photos[0]}
          alt={alt}
          className="aspect-square w-full object-cover"
        />
        {overlay}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2">
          {photos.map((photo, index) => (
            <button
              key={photo}
              type="button"
              onClick={() => setSelected(index)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                index === selected
                  ? "border-orange-500"
                  : "border-transparent hover:border-zinc-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

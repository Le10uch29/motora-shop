"use client";

import { useState, type ReactNode } from "react";
import ProductVisual from "@/components/ProductVisual";
import { productImageUrl } from "@/lib/productImageUrl";

const MAX_PHOTOS = 4;

export default function ProductGallery({
  images,
  alt,
  overlay,
}: {
  images: string[] | undefined;
  alt: string;
  overlay?: ReactNode;
}) {
  const photos = (images ?? []).slice(0, MAX_PHOTOS);
  const [selected, setSelected] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl">
        <ProductVisual className="aspect-square w-full" />
        {overlay}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImageUrl(photos[selected] ?? photos[0], "square")}
          alt={alt}
          className="aspect-square w-full object-fill"
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
              <img src={productImageUrl(photo, "thumb")} alt="" className="h-full w-full object-fill" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

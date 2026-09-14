import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { optimizeProductImage } from "@/lib/productImageOptimize";
import { optimizedImagePaths } from "@/lib/productImageUrl";

const BUCKET = "product-media";

/** Optimized files are never overwritten — a new photo gets a new id — so the
 * CDN and browsers may keep them for a year instead of re-checking hourly. */
const IMMUTABLE_CACHE_SECONDS = "31536000";

/**
 * Stores one product photo and returns the URL to save on the product.
 *
 * The photo is optimized into its container sizes first (see
 * productImageOptimize). Should the file be something the image library can't
 * read, it's stored exactly as given instead, so an upload never fails just
 * because optimization did — it only misses out on it.
 */
export async function storeProductImage(
  admin: SupabaseClient,
  bytes: Uint8Array,
  original: { name: string; contentType: string }
): Promise<string> {
  const storage = admin.storage.from(BUCKET);

  let variants: Awaited<ReturnType<typeof optimizeProductImage>> | null = null;
  try {
    variants = await optimizeProductImage(bytes);
  } catch {
    variants = null;
  }

  if (!variants) {
    const ext = original.name.split(".").pop() || "jpg";
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await storage.upload(path, bytes, {
      contentType: original.contentType || "image/jpeg",
    });
    if (error) throw new Error(error.message);
    return storage.getPublicUrl(path).data.publicUrl;
  }

  const paths = optimizedImagePaths(randomUUID());
  // The thumbnail goes first: a saved card URL is then a promise that its
  // thumbnail exists too, since thumbnails are found from the card's name.
  for (const variant of ["thumb", "card"] as const) {
    const { error } = await storage.upload(paths[variant], variants[variant], {
      contentType: "image/webp",
      cacheControl: IMMUTABLE_CACHE_SECONDS,
    });
    if (error) throw new Error(error.message);
  }
  return storage.getPublicUrl(paths.card).data.publicUrl;
}

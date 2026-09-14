/**
 * Where optimized product photos live, and how to get from the stored URL to
 * the size a given container needs.
 *
 * A product's `images` column keeps one URL per photo — the `card` variant.
 * Its smaller siblings sit next to it under the same id, so they're reached by
 * swapping the suffix rather than by storing more URLs. This file has no
 * server-only imports on purpose: the storefront's client components use it.
 */

export const OPTIMIZED_PRODUCT_IMAGE_DIR = "products/optimized";

const CARD_SUFFIX = "-card.webp";
const THUMB_SUFFIX = "-thumb.webp";

export function optimizedImagePaths(id: string) {
  return {
    card: `${OPTIMIZED_PRODUCT_IMAGE_DIR}/${id}${CARD_SUFFIX}`,
    thumb: `${OPTIMIZED_PRODUCT_IMAGE_DIR}/${id}${THUMB_SUFFIX}`,
  };
}

/** Whether a photo URL already points at an optimized card image. */
export function isOptimizedProductImage(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return path.includes(`/${OPTIMIZED_PRODUCT_IMAGE_DIR}/`) && path.endsWith(CARD_SUFFIX);
}

/**
 * The URL of a product photo sized for the small square boxes (search
 * suggestions, gallery thumbnails, admin table, invoice).
 *
 * Photos that were never optimized — pasted links, anything uploaded before —
 * have no thumbnail, so they come back unchanged and simply get scaled by the
 * browser as before.
 */
export function productThumbUrl(url: string): string {
  if (!isOptimizedProductImage(url)) return url;
  const [path, rest = ""] = url.split(/(?=[?#])/);
  return `${path.slice(0, -CARD_SUFFIX.length)}${THUMB_SUFFIX}${rest}`;
}

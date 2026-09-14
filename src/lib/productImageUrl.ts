/**
 * Where optimized product photos live, and how to get from the stored URL to
 * the version sized for a given box.
 *
 * A product's `images` column keeps one URL per photo — the `card` variant.
 * Its siblings for the other boxes sit next to it under the same id, so they're
 * reached by swapping the suffix rather than by storing more URLs. This file
 * has no server-only imports on purpose: the storefront's client components
 * use it.
 */

export const OPTIMIZED_PRODUCT_IMAGE_DIR = "products/optimized";

export type ProductImageBox = "card" | "square" | "thumb";

/** Current format: every variant has its box's exact size (see
 * productImageOptimize for how the part is fitted into it). */
const CURRENT_CARD = /-card-fill\.webp$/;
/** Earlier formats, still readable until they're rebuilt: a 4:3 canvas
 * ("-card.webp") and photos in their own proportions ("-card-800x267.webp").
 * They had a thumbnail but no square version. */
const LEGACY_CARD = /-card(?:-\d+x\d+)?\.webp$/;

export function optimizedImagePaths(id: string): Record<ProductImageBox, string> {
  return {
    card: `${OPTIMIZED_PRODUCT_IMAGE_DIR}/${id}-card-fill.webp`,
    square: `${OPTIMIZED_PRODUCT_IMAGE_DIR}/${id}-square-fill.webp`,
    thumb: `${OPTIMIZED_PRODUCT_IMAGE_DIR}/${id}-thumb-fill.webp`,
  };
}

function splitUrl(url: string): [path: string, rest: string] {
  const [path, rest = ""] = url.split(/(?=[?#])/);
  return [path, rest];
}

function inOptimizedDir(path: string): boolean {
  return path.includes(`/${OPTIMIZED_PRODUCT_IMAGE_DIR}/`);
}

/** Whether a photo URL points at an optimized card image, in any format. */
export function isOptimizedProductImage(url: string): boolean {
  const [path] = splitUrl(url);
  return inOptimizedDir(path) && (CURRENT_CARD.test(path) || LEGACY_CARD.test(path));
}

/** Whether a photo URL is in the current, box-filling format. */
export function isCurrentProductImage(url: string): boolean {
  const [path] = splitUrl(url);
  return inOptimizedDir(path) && CURRENT_CARD.test(path);
}

/**
 * The URL of a product photo sized for a given box: `card` (4:3 cards),
 * `square` (the product page) or `thumb` (small square boxes).
 *
 * Photos that were never optimized — pasted links, anything uploaded before —
 * have no other sizes, so they come back unchanged and the browser stretches
 * them to the box instead.
 */
export function productImageUrl(url: string, box: ProductImageBox): string {
  const [path, rest] = splitUrl(url);
  if (!inOptimizedDir(path) || box === "card") return url;
  if (CURRENT_CARD.test(path)) return `${path.replace(CURRENT_CARD, `-${box}-fill.webp`)}${rest}`;
  if (LEGACY_CARD.test(path) && box === "thumb") {
    return `${path.replace(LEGACY_CARD, "-thumb.webp")}${rest}`;
  }
  return url;
}

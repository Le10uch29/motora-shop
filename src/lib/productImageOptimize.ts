import sharp from "sharp";

/**
 * The sizes product photos are stored at, one per kind of container they're
 * shown in. Each is about twice the largest box it fills on screen, so it stays
 * sharp on high-density displays without shipping pixels nobody sees.
 *
 * - `card`: the 4:3 catalog/home card (up to ~620px wide on a wide screen, the
 *   full width of a phone) and the main picture on the product page.
 * - `thumb`: the small square boxes — search suggestions (80px), gallery
 *   thumbnails (64px), the admin table and the invoice (40px).
 */
export const PRODUCT_IMAGE_VARIANTS = {
  card: { width: 800, height: 600 },
  thumb: { width: 200, height: 200 },
} as const;

export type ProductImageVariant = keyof typeof PRODUCT_IMAGE_VARIANTS;

/** Share of each side left empty around the part, so it never touches the
 * edge of its box. */
const PADDING = 0.06;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** How close to white a border pixel may be and still count as background.
 * Supplier photos sit on an off-white (around #f8f8f8) with faint JPEG noise,
 * which a strict match would keep as "content". */
const TRIM_THRESHOLD = 28;

/** Removes the empty background around the part, so the part itself — not a
 * wide strip of white with the part somewhere in it — is what gets fitted to
 * the container. A picture that is blank or can't be trimmed stays as it is. */
async function trimBackground(flattened: Buffer): Promise<Buffer> {
  try {
    const { data, info } = await sharp(flattened)
      .trim({ background: "#ffffff", threshold: TRIM_THRESHOLD })
      .toBuffer({ resolveWithObject: true });
    // A trim down to a sliver means the picture was essentially empty.
    return info.width >= 8 && info.height >= 8 ? data : flattened;
  } catch {
    return flattened;
  }
}

/** Above this enlargement the resize is visibly soft, and a light unsharp mask
 * brings the part's edges back. Photos that are shrunk stay crisp on their own
 * and are left untouched. */
const SHARPEN_ABOVE_SCALE = 1.2;

async function renderVariant(
  subject: Buffer,
  subjectSize: { width: number; height: number },
  variant: ProductImageVariant
): Promise<Buffer> {
  const { width, height } = PRODUCT_IMAGE_VARIANTS[variant];
  const innerWidth = Math.round(width * (1 - PADDING * 2));
  const innerHeight = Math.round(height * (1 - PADDING * 2));
  const scale = Math.min(innerWidth / subjectSize.width, innerHeight / subjectSize.height);

  let pipeline = sharp(subject).resize({
    width: innerWidth,
    height: innerHeight,
    fit: "inside",
    kernel: sharp.kernel.lanczos3,
  });
  if (scale > SHARPEN_ABOVE_SCALE) pipeline = pipeline.sharpen({ sigma: 1, m1: 0.5, m2: 2.5 });
  const fitted = await pipeline.toBuffer();

  return sharp({ create: { width, height, channels: 3, background: WHITE } })
    .composite([{ input: fitted, gravity: "center" }])
    .webp({ quality: variant === "thumb" ? 80 : 84, effort: 5 })
    .toBuffer();
}

/**
 * Turns any product photo into the stored variants: upright, on white, cropped
 * to the part, centred in a canvas of its container's exact proportions and
 * saved as WebP.
 *
 * The proportions matter as much as the size. The containers crop to fill
 * themselves, so a wide 3:1 supplier photo placed in a 4:3 card or a square
 * gallery used to lose both ends of the part; fitted here instead, the whole
 * part shows, centred, in every box.
 */
export async function optimizeProductImage(
  input: Uint8Array
): Promise<Record<ProductImageVariant, Buffer>> {
  const flattened = await sharp(input, { failOn: "none" })
    .rotate()
    .flatten({ background: WHITE })
    .toBuffer();
  const subject = await trimBackground(flattened);
  const { width = 1, height = 1 } = await sharp(subject).metadata();

  const [card, thumb] = await Promise.all([
    renderVariant(subject, { width, height }, "card"),
    renderVariant(subject, { width, height }, "thumb"),
  ]);
  return { card, thumb };
}

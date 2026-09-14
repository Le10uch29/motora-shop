import sharp from "sharp";

/**
 * The exact sizes product photos are stored at — one per shape of box they're
 * shown in on the site. The boxes themselves are fixed and never change for a
 * photo; the photo is made to match its box instead.
 *
 * - `card`: the 4:3 catalog/home card (up to ~620px wide).
 * - `square`: the square main picture on the product page (up to ~700px).
 * - `thumb`: the small square boxes — search suggestions (80px), gallery
 *   thumbnails and form previews (64px), the admin table and the invoice (40px).
 */
export const PRODUCT_IMAGE_VARIANTS = {
  card: { width: 800, height: 600 },
  square: { width: 800, height: 800 },
  thumb: { width: 200, height: 200 },
} as const;

export type ProductImageVariant = keyof typeof PRODUCT_IMAGE_VARIANTS;

/** Thin white border around the part, as a share of the box's shorter side,
 * so the part doesn't run into the rounded corners of its box. */
const MARGIN = 0.03;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** How close to white a border pixel may be and still count as background.
 * Supplier photos sit on an off-white (around #f8f8f8) with faint JPEG noise,
 * which a strict match would keep as "content". */
const TRIM_THRESHOLD = 28;

/** Removes the empty background around the part, so it's the part that gets
 * sized to the box — not a wide strip of white with the part somewhere in it.
 * A picture that is blank or can't be trimmed stays as it is. */
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

/** How far a part may be stretched out of its own proportions to fill its box.
 * Up to this the distortion goes unnoticed; beyond it a long part squeezed into
 * a square turns into an unrecognisable blur. Whatever the stretch can't cover
 * is left as white space, split evenly on both sides. */
const MAX_STRETCH = 1.5;

/** The size the part is drawn at inside a box: filling the box outright when
 * its proportions are close enough, otherwise stretched as far as
 * MAX_STRETCH allows and filling the box along its longer direction. */
function drawnSize(
  subject: { width: number; height: number },
  box: { width: number; height: number }
): { width: number; height: number } {
  const subjectRatio = subject.width / subject.height;
  const boxRatio = box.width / box.height;

  if (subjectRatio >= boxRatio) {
    // Wider than the box: full width, height stretched up to the limit.
    const stretch = Math.min(subjectRatio / boxRatio, MAX_STRETCH);
    const height = Math.min(box.height, Math.round((box.width / subjectRatio) * stretch));
    return { width: box.width, height: Math.max(1, height) };
  }
  // Taller than the box: full height, width stretched up to the limit.
  const stretch = Math.min(boxRatio / subjectRatio, MAX_STRETCH);
  const width = Math.min(box.width, Math.round(box.height * subjectRatio * stretch));
  return { width: Math.max(1, width), height: box.height };
}

async function renderVariant(
  subject: Buffer,
  subjectSize: { width: number; height: number },
  variant: ProductImageVariant
): Promise<Buffer> {
  const { width, height } = PRODUCT_IMAGE_VARIANTS[variant];
  const margin = Math.round(Math.min(width, height) * MARGIN);
  const inner = { width: width - margin * 2, height: height - margin * 2 };
  const drawn = drawnSize(subjectSize, inner);

  // `fill` sizes width and height independently, which is what lets the part
  // be stretched a little towards its box's shape.
  let pipeline = sharp(subject).resize({
    width: drawn.width,
    height: drawn.height,
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  });
  const scale = Math.max(drawn.width / subjectSize.width, drawn.height / subjectSize.height);
  if (scale > SHARPEN_ABOVE_SCALE) pipeline = pipeline.sharpen({ sigma: 1, m1: 0.5, m2: 2.5 });
  const fitted = await pipeline.toBuffer();

  // Centre it: the box's margin, plus whatever the stretch limit left over.
  const spareX = inner.width - drawn.width;
  const spareY = inner.height - drawn.height;
  return sharp(fitted)
    .extend({
      left: margin + Math.floor(spareX / 2),
      right: margin + Math.ceil(spareX / 2),
      top: margin + Math.floor(spareY / 2),
      bottom: margin + Math.ceil(spareY / 2),
      background: WHITE,
    })
    .webp({ quality: variant === "thumb" ? 80 : 84, effort: 5 })
    .toBuffer();
}

/**
 * Turns any product photo into the stored variants: upright, on white, cropped
 * to the part, then sized to each box it's shown in — the file always has the
 * box's exact size, and the part fills it as far as MAX_STRETCH allows — as
 * WebP.
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

  const [card, square, thumb] = await Promise.all([
    renderVariant(subject, { width, height }, "card"),
    renderVariant(subject, { width, height }, "square"),
    renderVariant(subject, { width, height }, "thumb"),
  ]);
  return { card, square, thumb };
}

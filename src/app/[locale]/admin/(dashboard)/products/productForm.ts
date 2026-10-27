import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale, type Locale } from "@/i18n/locales";
import { storeProductImage } from "@/lib/productImageStorage";
import { fitmentsFromForm, type Fitment } from "@/lib/fitments";
import { normalizeOem } from "@/lib/oem";

/* Чтение формы товара и общие помощники создания и правки товара. Обычный
 * модуль, а не "use server": здесь синхронные функции и константы. */

/** Vehicle categories were dropped from the UI, but products.category is
 * still NOT NULL with no default in the schema, so every insert writes this
 * placeholder. Remove once the column itself is dropped. */
export const DEFAULT_CATEGORY = "universal";

export const MAX_IMAGES = 4;

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug || `product-${Date.now()}`;
}

export function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

function readLocalizedField(
  formData: FormData,
  prefix: string
): { ru: string; az: string; ka: string } | null {
  const ru = String(formData.get(`${prefix}Ru`) ?? "").trim();
  const az = String(formData.get(`${prefix}Az`) ?? "").trim();
  const ka = String(formData.get(`${prefix}Ka`) ?? "").trim();
  if (!ru && !az && !ka) return null;
  return { ru, az, ka };
}

type ParsedFields = {
  slug: string;
  brandId: string;
  fitments: Fitment[];
  price: number;
  oldPrice: number | null;
  stock: number;
  originCode: string | null;
  productCode: string | null;
  name: { ru: string; az: string; ka: string };
  description: { ru: string; az: string; ka: string };
  badge: { ru: string; az: string; ka: string } | null;
  isPopular: boolean;
};

export function readFields(formData: FormData): ParsedFields | null {
  const name = readLocalizedField(formData, "name");
  const description = readLocalizedField(formData, "description") ?? { ru: "", az: "", ka: "" };
  const slugInput = String(formData.get("slug") ?? "").trim();
  const brandId = String(formData.get("brandId") ?? "").trim();
  const make = String(formData.get("make") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  // Several vehicles are written as lists separated by ";" or ":" — the n-th
  // make goes with the n-th model and the n-th year range.
  const fitments = fitmentsFromForm({ make, model, years: String(formData.get("year") ?? "") });
  const price = Number(formData.get("price"));
  const oldPriceRaw = String(formData.get("oldPrice") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const originCode = String(formData.get("originCode") ?? "").trim();
  const productCode = String(formData.get("productCode") ?? "").trim();
  const badge = readLocalizedField(formData, "badge");
  const isPopular = formData.get("isPopular") === "on";

  if (
    !name ||
    !name.ru ||
    !name.az ||
    !name.ka ||
    !slugInput ||
    !brandId ||
    !make ||
    !fitments ||
    !Number.isFinite(price)
  ) {
    return null;
  }

  return {
    slug: slugify(slugInput),
    brandId,
    fitments,
    price,
    oldPrice: oldPriceRaw ? Number(oldPriceRaw) : null,
    stock: stockRaw ? Number(stockRaw) || 0 : 0,
    originCode: normalizeOem(originCode),
    productCode: productCode || null,
    name,
    description,
    badge,
    isPopular,
  };
}

/**
 * Files a product under its main category, replacing whatever it was under.
 *
 * A top-level category means "category known, subcategory not stated", so the
 * product goes to that category's "Разное" — the same rule the category panel
 * and the Excel import follow. An empty id leaves the product with no
 * category at all, which is a valid state: the shop shows it under "Все
 * товары" like everything else.
 *
 * Only the primary link is touched; any extra categories a product was given
 * elsewhere stay as they are.
 */
export async function setPrimaryCategory(
  admin: ReturnType<typeof createAdminClient>,
  productId: string,
  requestedCategoryId: string
): Promise<string | null> {
  let categoryId = requestedCategoryId;

  if (categoryId) {
    const { data: category } = await admin
      .from("categories")
      .select("id, parent_id")
      .eq("id", categoryId)
      .maybeSingle();
    if (!category) return null;
    if (category.parent_id === null) {
      const { data: fallback } = await admin
        .from("categories")
        .select("id")
        .eq("parent_id", categoryId)
        .eq("is_default", true)
        .maybeSingle();
      categoryId = fallback?.id ?? categoryId;
    }
  }

  const { data: links } = await admin
    .from("product_categories")
    .select("category_id, is_primary")
    .eq("product_id", productId);
  const current = (links ?? []).find((link) => link.is_primary);
  if (current?.category_id === categoryId) return null;

  if (current) {
    const { error } = await admin
      .from("product_categories")
      .delete()
      .eq("product_id", productId)
      .eq("category_id", current.category_id);
    if (error) return error.message;
  }
  if (!categoryId) return null;

  // Already linked without being primary (added from the category panel):
  // promote that row instead of inserting a duplicate.
  const existing = (links ?? []).find((link) => link.category_id === categoryId);
  const { error } = existing
    ? await admin
        .from("product_categories")
        .update({ is_primary: true })
        .eq("product_id", productId)
        .eq("category_id", categoryId)
    : await admin
        .from("product_categories")
        .insert({ product_id: productId, category_id: categoryId, is_primary: true });
  return error?.message ?? null;
}

export async function uploadImages(
  admin: ReturnType<typeof createAdminClient>,
  files: FormDataEntryValue[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    urls.push(
      await storeProductImage(admin, new Uint8Array(await file.arrayBuffer()), {
        name: file.name,
        contentType: file.type || "image/jpeg",
      })
    );
    if (urls.length >= MAX_IMAGES) break;
  }
  return urls;
}

/** Photos pasted as links instead of uploaded — one URL per line (commas
 * and spaces work too). Anything that isn't a well-formed http(s) URL is
 * dropped rather than stored as a broken <img src>. */
export function readImageUrls(formData: FormData): string[] {
  return String(formData.get("imageUrls") ?? "")
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    });
}

// Подгоняет уже загруженные фото товаров под рамки сайта: обрезает пустой фон
// вокруг детали и растягивает/сжимает её точно под размер каждой рамки —
// карточка 800×600, страница товара 800×800, маленькие окошки 200×200, всё в
// WebP. Сами рамки на сайте не меняются. Новые фото (импорт и форма товара)
// проходят ту же обработку сами — скрипт нужен для тех, что были загружены
// раньше, и для фото прежних форматов, которые он переделывает.
//
// Фото прежних форматов пересобираются из ОРИГИНАЛОВ (их адреса берутся из
// резервных копий в scripts/backups), а не из уже сжатой версии, чтобы не
// терять качество.
//
// Повторный запуск безопасен: фото текущего формата пропускаются.
// Старые файлы в хранилище НЕ удаляются, а прежние ссылки каждого товара
// сохраняются в резервную копию — всё можно вернуть как было.
//
// Запуск:
//   npm run optimize-images -- --dry-run      только показать, что изменится
//   npm run optimize-images                   обработать все фото
//   npm run optimize-images -- --limit 10     обработать первые 10 товаров
//   npm run optimize-images -- --force        пересобрать из оригиналов ВСЕ фото,
//                                             даже текущего формата (после смены
//                                             размеров в productImageOptimize.ts)
//   npm run optimize-images -- --restore scripts/backups/<файл>.json
//                                             вернуть ссылки из резервной копии

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { storeProductImage } from "../src/lib/productImageStorage";
import { isCurrentProductImage } from "../src/lib/productImageUrl";

/** A photo is done once it's in the current, box-filling format; the earlier
 * formats need redoing. */
function isCurrentFormat(image: string): boolean {
  return isCurrentProductImage(image);
}

/** For every URL a previous run produced, the original photo it came from —
 * followed back through every run, so a photo redone twice still leads to the
 * file that was actually uploaded. */
function loadOriginals(): Map<string, string> {
  const derivedFrom = new Map<string, string>();
  if (!existsSync("scripts/backups")) return derivedFrom;
  for (const file of readdirSync("scripts/backups").sort()) {
    const entries = JSON.parse(readFileSync(`scripts/backups/${file}`, "utf8")) as BackupEntry[];
    for (const entry of entries) {
      entry.after.forEach((after, index) => {
        const before = entry.before[index];
        if (before && before !== after) derivedFrom.set(after, before);
      });
    }
  }
  const originals = new Map<string, string>();
  for (const derived of derivedFrom.keys()) {
    let source = derived;
    const seen = new Set<string>();
    while (derivedFrom.has(source) && !seen.has(source)) {
      seen.add(source);
      source = derivedFrom.get(source)!;
    }
    originals.set(derived, source);
  }
  return originals;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error(
    "Не найдены NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — проверьте .env.local"
  );
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitArg = args.indexOf("--limit");
const limit = limitArg === -1 ? Infinity : Number(args[limitArg + 1]);
const restoreArg = args.indexOf("--restore");
const restoreFrom = restoreArg === -1 ? null : args[restoreArg + 1];

const originals = loadOriginals();

/** Anything not in the current format needs work. With --force, so does every
 * current photo whose original is still known — but never one without: that
 * would re-compress an already compressed file and only lose quality. */
function needsWork(image: string): boolean {
  if (!isCurrentFormat(image)) return true;
  return force && originals.has(image);
}

const CONCURRENCY = 8;
const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

type ProductImages = { id: string; product_code: string | null; images: string[] | null };
type BackupEntry = { id: string; before: string[]; after: string[] };

async function fetchAllProducts(): Promise<ProductImages[]> {
  const products: ProductImages[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_code, images")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    products.push(...(data ?? []));
    if (!data || data.length < 1000) return products;
  }
}

async function download(imageUrl: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") ?? "",
      };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

/** Runs `worker` over `items`, at most CONCURRENCY at a time. */
async function inParallel<T>(items: T[], worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    })
  );
}

async function restore(path: string) {
  const entries = JSON.parse(readFileSync(path, "utf8")) as BackupEntry[];
  let restored = 0;
  for (const entry of entries) {
    const { error } = await supabase.from("products").update({ images: entry.before }).eq("id", entry.id);
    if (error) console.error(`  ${entry.id}: ${error.message}`);
    else restored++;
  }
  console.log(`Возвращены прежние фото у ${restored} из ${entries.length} товаров.`);
}

async function main() {
  if (restoreFrom) return restore(restoreFrom);

  const products = (await fetchAllProducts())
    .filter((p) => (p.images ?? []).some((image) => needsWork(image)))
    .slice(0, limit);

  // One picture can be shared by several products (the import uploads a
  // repeated picture once), so each distinct URL is processed only once.
  const pending = Array.from(
    new Set(products.flatMap((p) => (p.images ?? []).filter((i) => needsWork(i))))
  );
  const fromOriginal = pending.filter((image) => originals.has(image)).length;
  console.log(
    `Товаров с фото не в текущем формате: ${products.length}, разных фото: ${pending.length}` +
      ` (из оригинала: ${fromOriginal}, как есть: ${pending.length - fromOriginal})`
  );
  if (dryRun || pending.length === 0) return;

  const replacement = new Map<string, string>();
  const failures: { url: string; error: string }[] = [];
  let bytesBefore = 0;
  let done = 0;

  await inParallel(pending, async (imageUrl) => {
    try {
      const sourceUrl = originals.get(imageUrl) ?? imageUrl;
      const { bytes, contentType } = await download(sourceUrl);
      bytesBefore += bytes.length;
      const name = sourceUrl.split(/[?#]/)[0].split("/").pop() ?? "image";
      replacement.set(imageUrl, await storeProductImage(supabase, bytes, { name, contentType }));
    } catch (error) {
      failures.push({ url: imageUrl, error: error instanceof Error ? error.message : String(error) });
    }
    done++;
    if (done % 50 === 0 || done === pending.length) console.log(`  обработано ${done}/${pending.length}`);
  });

  // The backup is written before any product changes, so an interrupted run
  // can still be undone.
  const backup: BackupEntry[] = products
    .map((p) => {
      const before = p.images ?? [];
      return { id: p.id, before, after: before.map((image) => replacement.get(image) ?? image) };
    })
    .filter((entry) => entry.after.some((image, i) => image !== entry.before[i]));

  mkdirSync("scripts/backups", { recursive: true });
  const backupPath = `scripts/backups/product-images-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Резервная копия прежних ссылок: ${backupPath}`);

  let updated = 0;
  await inParallel(backup, async (entry) => {
    const { error } = await supabase.from("products").update({ images: entry.after }).eq("id", entry.id);
    if (error) failures.push({ url: `product ${entry.id}`, error: error.message });
    else updated++;
  });

  console.log(`Обновлено товаров: ${updated}. Исходный объём фото: ${(bytesBefore / 1024 / 1024).toFixed(2)} МБ.`);
  if (failures.length > 0) {
    console.log(`Не удалось: ${failures.length}`);
    for (const failure of failures.slice(0, 20)) console.log(`  ${failure.url}: ${failure.error}`);
  }
}

main();

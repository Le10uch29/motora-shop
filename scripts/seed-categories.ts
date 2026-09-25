// Заводит стартовый справочник категорий запчастей в Supabase.
//
// Скрипт идемпотентный: он сверяется с тем, что уже есть в базе, по slug, и
// создаёт только недостающее. Повторный запуск ничего не дублирует и ничего
// не перезаписывает — переименованная или отредактированная в админке
// категория остаётся такой, какой её там сделали. Удалённую категорию он
// создаст заново, это плата за то, что он не ведёт учёт удалений.
//
// Использует секретный ключ (в обход RLS), поэтому запускается только
// локально с машины разработчика, никогда не как часть приложения.
//
// Запуск: npm run seed:categories

import { createClient } from "@supabase/supabase-js";
import {
  CATEGORY_TAXONOMY,
  MISC_NAME,
  MISC_SLUG_SUFFIX,
  type SeedName,
} from "./data/categoryTaxonomy";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error(
    "Не найдены NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — проверьте .env.local"
  );
}

const supabase = createClient(url, secretKey);

type ExistingRow = { id: string; slug: string; parent_id: string | null; is_default: boolean };

type NewRow = {
  slug: string;
  name: SeedName;
  parent_id: string | null;
  sort_order: number;
  is_default: boolean;
};

let created = 0;
let skipped = 0;

async function insert(row: NewRow): Promise<string> {
  const { data, error } = await supabase.from("categories").insert(row).select("id").single();
  if (error) throw new Error(`Категория ${row.slug}: ${error.message}`);
  created++;
  return data.id;
}

async function main() {
  const { data: existingRows, error } = await supabase
    .from("categories")
    .select("id, slug, parent_id, is_default");
  if (error) throw new Error(`Не удалось прочитать категории: ${error.message}`);

  const existing = new Map((existingRows ?? []).map((row: ExistingRow) => [row.slug, row]));
  console.log(`В базе уже есть категорий: ${existing.size}`);

  for (const [index, category] of CATEGORY_TAXONOMY.entries()) {
    const sortOrder = (index + 1) * 10;
    let parentId = existing.get(category.slug)?.id;

    if (parentId) {
      skipped++;
      console.log(`  = ${category.name.ru} (уже есть)`);
    } else {
      parentId = await insert({
        slug: category.slug,
        name: category.name,
        parent_id: null,
        sort_order: sortOrder,
        is_default: false,
      });
      console.log(`  + ${category.name.ru}`);
    }

    const children = [
      ...category.children.map((child, childIndex) => ({
        slug: child.slug,
        name: child.name,
        sortOrder: (childIndex + 1) * 10,
        isDefault: false,
      })),
      // "Разное" всегда последняя: это техническая подкатегория, а не
      // равноправный пункт списка.
      {
        slug: `${category.slug}-${MISC_SLUG_SUFFIX}`,
        name: MISC_NAME,
        sortOrder: 9000,
        isDefault: true,
      },
    ];

    for (const child of children) {
      if (existing.has(child.slug)) {
        skipped++;
        continue;
      }
      await insert({
        slug: child.slug,
        name: child.name,
        parent_id: parentId,
        sort_order: child.sortOrder,
        is_default: child.isDefault,
      });
      console.log(`      + ${child.name.ru}`);
    }
  }

  console.log(`\nГотово. Создано: ${created}, пропущено (уже было): ${skipped}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

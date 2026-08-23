// Одноразовый скрипт: переносит бренды и тексты страниц из src/lib/i18n в
// базу Supabase. Использует секретный ключ (он в обход RLS), поэтому
// запускается только локально с машины разработчика, никогда не как часть
// приложения.
//
// Товары больше не сеются отсюда: они уже перенесены в Supabase и теперь
// управляются через админ-панель (/admin/products) — повторный запуск
// сида для товаров затёр бы правки, сделанные там.
//
// Запуск: npm run seed

import { createClient } from "@supabase/supabase-js";
import ru from "../src/i18n/dictionaries/ru";
import az from "../src/i18n/dictionaries/az";
import ka from "../src/i18n/dictionaries/ka";

const brands = [
  { slug: "araz", name: "Araz" },
  { slug: "elring", name: "Elring" },
  { slug: "aplus-automotive", name: "APLUS AUTOMOTIVE" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error(
    "Не найдены NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — проверьте .env.local"
  );
}

const supabase = createClient(url, secretKey);

async function seedBrands() {
  for (const brand of brands) {
    const { error } = await supabase
      .from("brands")
      .upsert(
        { slug: brand.slug, name: brand.name },
        { onConflict: "slug", ignoreDuplicates: false }
      );

    if (error) throw new Error(`Бренд ${brand.slug}: ${error.message}`);
    console.log(`  бренд: ${brand.name}`);
  }
}

async function seedPages() {
  const body = { ru: ru.pages.comingSoon, az: az.pages.comingSoon, ka: ka.pages.comingSoon };
  const pageDefs = [
    { slug: "promotions", title: { ru: ru.header.promotions, az: az.header.promotions, ka: ka.header.promotions } },
    { slug: "about", title: { ru: ru.header.about, az: az.header.about, ka: ka.header.about } },
    { slug: "products", title: { ru: ru.header.products, az: az.header.products, ka: ka.header.products } },
    { slug: "contacts", title: { ru: ru.header.contacts, az: az.header.contacts, ka: ka.header.contacts } },
  ];

  for (const page of pageDefs) {
    const { error } = await supabase
      .from("pages")
      .upsert({ slug: page.slug, title: page.title, body }, { onConflict: "slug" });

    if (error) throw new Error(`Страница ${page.slug}: ${error.message}`);
    console.log(`  страница: ${page.slug}`);
  }
}

async function main() {
  console.log("Бренды...");
  await seedBrands();

  console.log("Страницы...");
  await seedPages();

  console.log(`Готово: ${brands.length} брендов, 4 страницы.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

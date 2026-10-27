-- Каталог закрыт: товары, бренды, категории и связи товар–категория читают
-- только вошедшие — сотрудник (is_staff(), в том числе админ) или покупатель
-- (is_customer()). Раньше чтение было открыто всем, включая анонимный ключ,
-- который виден в браузере: цены и остатки можно было выгрузить через REST
-- API, не входя на сайт, хотя сама витрина требует входа (src/proxy.ts).
--
-- Таблица pages тоже закрыта: приложение её не читает (тексты страниц живут
-- в словарях), её пишет только скрипт seed секретным ключом.
--
-- Запись не меняется: её по-прежнему разрешают политики admin_write_*.
-- Фото товаров лежат в публичном бакете product-media и остаются доступны
-- по прямой ссылке — это не меняется.
--
-- Порядок выкатки: СНАЧАЛА деплой кода (он читает каталог сессией
-- пользователя), ПОТОМ этот SQL. Если сделать наоборот, старый код, который
-- читает каталог анонимным клиентом, покажет пустую витрину до деплоя.
--
-- Идемпотентно: можно запускать повторно.

drop policy if exists "public_read_products" on products;
drop policy if exists "member_read_products" on products;
create policy "member_read_products" on products for select to authenticated
  using (is_staff() or is_customer());

drop policy if exists "public_read_brands" on brands;
drop policy if exists "member_read_brands" on brands;
create policy "member_read_brands" on brands for select to authenticated
  using (is_staff() or is_customer());

drop policy if exists "public_read_categories" on categories;
drop policy if exists "member_read_categories" on categories;
create policy "member_read_categories" on categories for select to authenticated
  using (is_staff() or is_customer());

drop policy if exists "public_read_product_categories" on product_categories;
drop policy if exists "member_read_product_categories" on product_categories;
create policy "member_read_product_categories" on product_categories for select to authenticated
  using (is_staff() or is_customer());

drop policy if exists "public_read_pages" on pages;
drop policy if exists "member_read_pages" on pages;
create policy "member_read_pages" on pages for select to authenticated
  using (is_staff() or is_customer());

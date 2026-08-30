-- Araz Motors: схема базы для брендов, товаров, текстов страниц и
-- сотрудников (админы/продавцы). Выполнить целиком в Supabase Dashboard ->
-- SQL Editor -> New query -> Run.

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  -- Крупный логотип для карточки бренда на /brands.
  logo_url text,
  -- Компактная метка, которая накладывается на фото товара (левый верхний
  -- угол) при выборе этого бренда — отдельная картинка от logo_url.
  badge_logo_url text,
  created_at timestamptz not null default now()
);
alter table brands add column if not exists badge_logo_url text;
-- Short abbreviation shown before a product's code (e.g. "APLUS AUTOMOTIVE"
-- -> "A-Plus") — product code display becomes "{initials}-{product_code}".
alter table brands add column if not exists initials text;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null,
  make text not null,
  brand_id uuid references brands(id) on delete set null,
  year_from int not null,
  year_to int not null,
  price numeric not null,
  old_price numeric,
  stock int not null default 0,
  origin_code text,
  product_code text,
  name jsonb not null,
  description jsonb not null,
  specs jsonb not null default '[]'::jsonb,
  badge jsonb,
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Модель автомобиля (и код шасси, где уместно), к которому подходит деталь.
alter table products add column if not exists model text;
-- Показывать товар в блоке "Популярное" на главной странице.
alter table products add column if not exists is_popular boolean not null default false;

-- Склады: физические точки хранения товара. Сколько и какого товара лежит
-- на складе — отдельная таблица warehouse_stock, не влияет на product.stock
-- (общий остаток на сайте) и не показывается на витрине.
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, product_id)
);

create table if not exists pages (
  slug text primary key,
  title jsonb not null,
  body jsonb not null,
  updated_at timestamptz not null default now()
);

-- Сотрудники (админы и продавцы). id совпадает с auth.users.id — учётка для
-- входа создаётся отдельно через Supabase Auth Admin API, эта таблица хранит
-- только профиль поверх неё.
do $$ begin
  create type staff_role as enum ('admin', 'seller');
exception
  when duplicate_object then null;
end $$;

create table if not exists staff (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  id_card_number text,
  role staff_role not null default 'seller',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Склад/магазин, за которым закреплён сотрудник (в основном для продавцов).
alter table staff add column if not exists warehouse_id uuid references warehouses(id) on delete set null;

-- Журнал действий: кто что добавил/изменил/удалил. staff_id обнуляется (не
-- каскадно удаляется), чтобы запись в логе пережила увольнение сотрудника —
-- имя сохраняется отдельно на момент действия.
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete set null,
  staff_name text not null,
  action text not null,
  entity_type text not null,
  entity_label text not null,
  -- id of the row the action was performed ON (staff/customer/product/...).
  -- Not a foreign key: it can point at rows in different tables depending on
  -- entity_type, and should still resolve after the row itself is deleted.
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table logs add column if not exists entity_id uuid;

-- Автообновление updated_at при изменении строки.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

drop trigger if exists pages_set_updated_at on pages;
create trigger pages_set_updated_at
  before update on pages
  for each row execute function set_updated_at();

drop trigger if exists staff_set_updated_at on staff;
create trigger staff_set_updated_at
  before update on staff
  for each row execute function set_updated_at();

drop trigger if exists warehouses_set_updated_at on warehouses;
create trigger warehouses_set_updated_at
  before update on warehouses
  for each row execute function set_updated_at();

drop trigger if exists warehouse_stock_set_updated_at on warehouse_stock;
create trigger warehouse_stock_set_updated_at
  before update on warehouse_stock
  for each row execute function set_updated_at();

-- Проверка "текущий пользователь — админ". SECURITY DEFINER нужен, чтобы
-- политика на самой таблице staff не зацикливалась сама на себя.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from staff where id = auth.uid() and role = 'admin'
  );
$$;

-- Проверка "текущий пользователь — сотрудник" (админ или продавец).
create or replace function is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from staff where id = auth.uid()
  );
$$;

-- Row Level Security.
alter table brands enable row level security;
alter table products enable row level security;
alter table pages enable row level security;
alter table staff enable row level security;
alter table logs enable row level security;
alter table warehouses enable row level security;
alter table warehouse_stock enable row level security;

-- Каталог (brands/products/pages): читать может кто угодно — витрина сайта
-- работает без входа. Писать — только админ (не продавец: у него только
-- просмотр).
drop policy if exists "public_read_brands" on brands;
create policy "public_read_brands" on brands for select using (true);
drop policy if exists "admin_write_brands" on brands;
create policy "admin_write_brands" on brands for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "public_read_products" on products;
create policy "public_read_products" on products for select using (true);
drop policy if exists "admin_write_products" on products;
create policy "admin_write_products" on products for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "public_read_pages" on pages;
create policy "public_read_pages" on pages for select using (true);
drop policy if exists "admin_write_pages" on pages;
create policy "admin_write_pages" on pages for all to authenticated using (is_admin()) with check (is_admin());

-- Раздел "Сотрудники" целиком только для админов — продавец его не видит.
drop policy if exists "admin_manage_staff" on staff;
create policy "admin_manage_staff" on staff for all to authenticated using (is_admin()) with check (is_admin());

-- Без этого продавец не может прочитать даже собственную строку своей же
-- сессией (getCurrentStaff() в lib/auth.ts делает select не через
-- service-role) — requireStaff() будет считать его разлогиненным и
-- отправлять обратно на /admin/login при каждом заходе.
drop policy if exists "staff_read_self" on staff;
create policy "staff_read_self" on staff for select to authenticated using (id = auth.uid());

-- Логи — читать и очищать может только админ.
drop policy if exists "admin_manage_logs" on logs;
create policy "admin_manage_logs" on logs for all to authenticated using (is_admin()) with check (is_admin());

-- Склады: раньше их видели все сотрудники, но раздел "Склады" и "Бренды" не
-- входят в явно перечисленный набор прав продавца (товары/поиск/статус
-- заказа/цена в заказе) — теперь только админ, и на чтение тоже. Не
-- публичные — витрина сайта эти таблицы не читает.
drop policy if exists "staff_read_warehouses" on warehouses;
drop policy if exists "admin_read_warehouses" on warehouses;
create policy "admin_read_warehouses" on warehouses for select to authenticated using (is_admin());
drop policy if exists "admin_write_warehouses" on warehouses;
create policy "admin_write_warehouses" on warehouses for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "staff_read_warehouse_stock" on warehouse_stock;
drop policy if exists "admin_read_warehouse_stock" on warehouse_stock;
create policy "admin_read_warehouse_stock" on warehouse_stock for select to authenticated using (is_admin());
drop policy if exists "admin_write_warehouse_stock" on warehouse_stock;
create policy "admin_write_warehouse_stock" on warehouse_stock for all to authenticated using (is_admin()) with check (is_admin());

-- Storage-бакет для фото товаров и логотипов брендов.
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

drop policy if exists "public_read_product_media" on storage.objects;
create policy "public_read_product_media" on storage.objects
  for select using (bucket_id = 'product-media');

drop policy if exists "admin_upload_product_media" on storage.objects;
create policy "admin_upload_product_media" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-media' and is_admin());

drop policy if exists "admin_update_product_media" on storage.objects;
create policy "admin_update_product_media" on storage.objects
  for update to authenticated using (bucket_id = 'product-media' and is_admin());

drop policy if exists "admin_delete_product_media" on storage.objects;
create policy "admin_delete_product_media" on storage.objects
  for delete to authenticated using (bucket_id = 'product-media' and is_admin());

-- Покупатели: заводит только админ (Сотрудники -> Покупатели в панели). Сам
-- покупатель логинится через Supabase Auth так же, как staff — id совпадает
-- с auth.users.id, эта таблица хранит только профиль поверх учётки.
create table if not exists customers (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  id_card_number text not null,
  organization_name text not null,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Адрес доставки. default '' (not just nullable) so this stays a hard
-- not-null constraint like the rest of the required profile fields, while
-- still being safe to run against a table that may already have rows from
-- before these columns existed.
alter table customers add column if not exists address text not null default '';
alter table customers add column if not exists postal_code text not null default '';
alter table customers add column if not exists city text not null default '';

drop trigger if exists customers_set_updated_at on customers;
create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- Проверка "текущий пользователь — покупатель".
create or replace function is_customer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from customers where id = auth.uid()
  );
$$;

alter table customers enable row level security;

-- Раздел "Покупатели" целиком управляется только админом.
drop policy if exists "admin_manage_customers" on customers;
create policy "admin_manage_customers" on customers for all to authenticated using (is_admin()) with check (is_admin());

-- Покупатель видит и обновляет только свою же карточку (фото — из личного
-- кабинета на витрине). Смена пароля идёт через Supabase Auth, не эту таблицу.
drop policy if exists "customer_read_self" on customers;
create policy "customer_read_self" on customers for select to authenticated using (id = auth.uid());
drop policy if exists "customer_update_self" on customers;
create policy "customer_update_self" on customers for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- RLS above is row-level only — without this, a customer's own session could
-- still PATCH any column on their own row (name, ID card, organization...)
-- via a direct REST call, not just the photo the app actually exposes to
-- them. Column-level grants close that: admin writes always go through the
-- service-role client, which bypasses grants and RLS entirely, so this only
-- restricts what a customer's own session can touch.
revoke update on customers from authenticated;
grant update (photo_url) on customers to authenticated;

-- Storage-бакет для фото покупателей.
insert into storage.buckets (id, name, public)
values ('customer-media', 'customer-media', true)
on conflict (id) do nothing;

drop policy if exists "public_read_customer_media" on storage.objects;
create policy "public_read_customer_media" on storage.objects
  for select using (bucket_id = 'customer-media');

drop policy if exists "admin_manage_customer_media" on storage.objects;
create policy "admin_manage_customer_media" on storage.objects
  for all to authenticated
  using (bucket_id = 'customer-media' and is_admin())
  with check (bucket_id = 'customer-media' and is_admin());

-- Покупатель может загружать/менять/удалять только файлы в своей папке
-- ({auth.uid()}/...) — используется в личном кабинете для смены фото.
drop policy if exists "customer_manage_own_media" on storage.objects;
create policy "customer_manage_own_media" on storage.objects
  for all to authenticated
  using (bucket_id = 'customer-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'customer-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Заказы: оформляет сам покупатель из корзины (одна строка = один товар в
-- заказе, а не заказ с вложенными позициями — проще и ровно то, что видно
-- в разделе "Заказы"). product_id обнуляется, а не каскадно удаляется, чтобы
-- заказ пережил удаление товара из каталога — название/цена на момент
-- заказа сохранены отдельно, как staff_name в logs.
--
-- customer_id ссылается на auth.users, а не на customers: сотрудники
-- (админ/продавец) тоже могут оформить заказ через корзину — не у всех
-- есть строка в customers. Кто есть кто, определяется на чтении: сначала
-- ищем в customers, если нет — в staff.
do $$ begin
  create type order_status as enum ('new', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name jsonb not null,
  price_at_order numeric not null,
  quantity int not null default 1,
  status order_status not null default 'new',
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Was `references customers(id)` originally — loosened so staff can order
-- too. Safe to re-run: only rewrites the constraint if it still points at
-- customers.
do $$ begin
  alter table orders drop constraint if exists orders_customer_id_fkey;
  alter table orders add constraint orders_customer_id_fkey
    foreign key (customer_id) references auth.users(id) on delete cascade;
exception
  when others then null;
end $$;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

alter table orders enable row level security;

-- Отменить заказ (запись) может только админ — как и везде в панели,
-- продавцу доступен только просмотр (staff_read_orders ниже).
drop policy if exists "admin_manage_orders" on orders;
create policy "admin_manage_orders" on orders for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "staff_read_orders" on orders;
create policy "staff_read_orders" on orders for select to authenticated using (is_staff());

-- Оформление заказа идёт из личной сессии заказчика (без service-role
-- клиента), поэтому нужны собственные insert/select-политики. Не только для
-- покупателей — то же самое разрешает и сотруднику оформить свой заказ.
drop policy if exists "customer_insert_own_orders" on orders;
drop policy if exists "orderer_insert_own_orders" on orders;
create policy "orderer_insert_own_orders" on orders for insert to authenticated with check (customer_id = auth.uid());
drop policy if exists "customer_read_own_orders" on orders;
drop policy if exists "orderer_read_own_orders" on orders;
create policy "orderer_read_own_orders" on orders for select to authenticated using (customer_id = auth.uid());

-- Короткий номер заказа для инвойсов/справок (6 цифр, начиная со 100000).
-- default nextval(...) на ADD COLUMN проставляет уникальные номера и для уже
-- существующих строк, так что безопасно накатывать повторно.
create sequence if not exists order_number_seq start 100000;
alter table orders add column if not exists order_number int not null default nextval('order_number_seq');

-- Этапы выполнения заказа. ALTER TYPE ... ADD VALUE не может идти внутри
-- do $$ ... $$ вместе с другим DDL в одной транзакции на старых Postgres,
-- поэтому это простые верхнеуровневые команды — их безопасно повторять
-- благодаря IF NOT EXISTS.
alter type order_status add value if not exists 'gathering';
alter type order_status add value if not exists 'gathered';
alter type order_status add value if not exists 'shipped';
alter type order_status add value if not exists 'delivered';

-- Продавец может двигать статус заказа по этапам выполнения, но не отменять
-- его — отмена (admin_manage_orders выше) остаётся только у админа.
drop policy if exists "staff_update_order_status" on orders;
create policy "staff_update_order_status" on orders for update to authenticated
  using (is_staff()) with check (is_staff() and status <> 'cancelled');

-- Склад, который сейчас обрабатывает заказ — проставляется автоматически
-- (склад сотрудника, который последним подвинул статус), не выбирается
-- вручную. Скидочная цена — необязательное переопределение price_at_order,
-- как old_price у products: null значит "используем обычную цену".
alter table orders add column if not exists warehouse_id uuid references warehouses(id) on delete set null;
alter table orders add column if not exists discounted_price numeric;

-- Момент списания склада при переходе в "отправлен" (once) — не сам факт
-- списания, а метка "уже списали", чтобы повторный выбор статуса "отправлен"
-- не вычитал остаток дважды.
alter table orders add column if not exists stock_deducted_at timestamptz;

-- Цена и название заказа всегда берутся из живого товара на момент вставки,
-- а не из того, что прислал клиент — иначе оформление заказа своей же
-- сессией (orderer_insert_own_orders) позволило бы указать любую цену
-- напрямую через REST API, в обход server action'а, который сам сверяет
-- цену с products.price. Триггер делает это гарантией на уровне БД.
create or replace function set_order_price_from_product()
returns trigger as $$
begin
  if new.product_id is not null then
    select price, name into new.price_at_order, new.product_name
    from products where id = new.product_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_price_from_product on orders;
create trigger orders_set_price_from_product
  before insert on orders
  for each row execute function set_order_price_from_product();

-- RLS-политики выше проверяют только владельца строки, но не то, какие
-- именно столбцы меняются — без этих грантов покупатель мог бы через REST
-- API вставить заказ сразу со статусом 'delivered' или скидкой, а сотрудник
-- (даже с политикой staff_update_order_status) мог бы напрямую поменять
-- price_at_order/customer_id/order_number в обход server action'ов.
-- Excel import: when the same product code appears more than once in one
-- file with conflicting values (currently just price), the higher value is
-- kept automatically and a row is logged here so an admin can double-check
-- it later — see importProductsAction / ImportConflictsModal.
create table if not exists import_conflicts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  product_code text not null,
  origin_code text,
  field text not null,
  values text[] not null,
  resolved_value text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table import_conflicts enable row level security;
drop policy if exists "admin_manage_import_conflicts" on import_conflicts;
create policy "admin_manage_import_conflicts" on import_conflicts for all
  to authenticated using (is_admin()) with check (is_admin());

revoke insert on orders from authenticated;
grant insert (customer_id, product_id, quantity) on orders to authenticated;

revoke update on orders from authenticated;
grant update (status, warehouse_id, stock_deducted_at, discounted_price) on orders to authenticated;

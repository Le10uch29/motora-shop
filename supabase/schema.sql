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
  details jsonb,
  created_at timestamptz not null default now()
);

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

-- Row Level Security.
alter table brands enable row level security;
alter table products enable row level security;
alter table pages enable row level security;
alter table staff enable row level security;
alter table logs enable row level security;

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

-- Логи — читать и очищать может только админ.
drop policy if exists "admin_manage_logs" on logs;
create policy "admin_manage_logs" on logs for all to authenticated using (is_admin()) with check (is_admin());

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

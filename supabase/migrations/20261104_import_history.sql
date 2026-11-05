-- История Excel-импортов товаров — страховка от ошибочного импорта (например,
-- файл бренда Elring загрузили в APLUS).
--
-- import_runs        — один запуск импорта: кто, когда, файл, бренд, склад,
--                      итоговые цифры; статус отката и переноса на другой бренд.
-- import_run_items   — что импорт сделал с каждым товаром: создал новый или
--                      дополнил существующий; для дополненных — прежние
--                      значения изменённых полей (previous), чтобы их вернуть.
-- import_run_stock   — какие остатки на складах импорт проставил и что там
--                      было до него (null — строки склада не было).
--
-- По этим записям раздел «История импортов» умеет откатить импорт, перенести
-- созданные им товары на другой бренд и показать товары конкретного импорта.
-- Пишет и читает только админ (через серверный ключ, после проверки роли).
--
-- Порядок выкатки любой: код без этих таблиц работает (импорт проходит, просто
-- без записи в историю). Идемпотентно: можно запускать повторно.

create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete set null,
  brand_name text not null,
  warehouse_id uuid references warehouses(id) on delete set null,
  warehouse_name text,
  file_name text,
  staff_id uuid references staff(id) on delete set null,
  staff_name text not null,
  created_count int not null default 0,
  updated_count int not null default 0,
  unchanged_count int not null default 0,
  skipped_count int not null default 0,
  conflicts_count int not null default 0,
  stock_count int not null default 0,
  -- 'done' или 'rolled_back'.
  status text not null default 'done' check (status in ('done', 'rolled_back')),
  rolled_back_at timestamptz,
  rolled_back_by text,
  -- Перенос созданных импортом товаров на другой бренд.
  moved_to_brand_id uuid references brands(id) on delete set null,
  moved_to_brand_name text,
  moved_at timestamptz,
  -- Строка создаётся ПОСЛЕ записи товаров: created_at (время базы) — граница,
  -- после которой изменение товара считается ручной правкой.
  created_at timestamptz not null default now()
);
create index if not exists import_runs_created_idx on import_runs (created_at desc);

create table if not exists import_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references import_runs(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_code text not null,
  action text not null check (action in ('created', 'updated')),
  previous jsonb,
  created_at timestamptz not null default now()
);
create index if not exists import_run_items_run_idx on import_run_items (run_id);
create index if not exists import_run_items_product_idx on import_run_items (product_id);

create table if not exists import_run_stock (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references import_runs(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  quantity int not null,
  previous_quantity int
);
create index if not exists import_run_stock_run_idx on import_run_stock (run_id);

alter table import_runs enable row level security;
alter table import_run_items enable row level security;
alter table import_run_stock enable row level security;

drop policy if exists "admin_manage_import_runs" on import_runs;
create policy "admin_manage_import_runs" on import_runs for all
  to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin_manage_import_run_items" on import_run_items;
create policy "admin_manage_import_run_items" on import_run_items for all
  to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin_manage_import_run_stock" on import_run_stock;
create policy "admin_manage_import_run_stock" on import_run_stock for all
  to authenticated using (is_admin()) with check (is_admin());

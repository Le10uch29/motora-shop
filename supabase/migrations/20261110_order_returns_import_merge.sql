-- Возвраты заказов и шаг «заменить / прибавить» после Excel-импорта.
--
-- 1. Возврат товара по заказу.
--    Вернуть можно только то, что уже списано со склада (заказ отправлен —
--    orders.stock_deducted_at заполнен). Возврат прибавляет количество обратно
--    к общему остатку товара и к остатку склада, с которого товар уходил
--    (orders.warehouse_id), и записывается в order_returns.
--    Строка заказа не удаляется и не меняет количество: в ней растёт
--    returned_quantity, а сумма заказа считается за вычетом возвращённого.
--    Всё делает одна функция return_order_lines в одной транзакции: либо
--    возвращаются все выбранные позиции, либо ни одна (и двойной клик не
--    вернёт товар дважды — строка заказа блокируется на время возврата).
--
-- 2. import_runs.merged_at — время, когда к импорту применили шаг «заменить /
--    прибавить» для уже существующих товаров. Откат импорта считает товар
--    «правленым вручную», если он изменён позже записи импорта; изменения
--    этого шага — часть импорта, поэтому граница сдвигается на merged_at.
--
-- Порядок выкатки: сначала этот SQL, потом код. Код без SQL возвраты не
-- покажет (кнопки возврата не будет), остальное работает как раньше.
-- Идемпотентно: можно запускать повторно.

alter table orders add column if not exists returned_quantity int not null default 0;

do $$ begin
  alter table orders add constraint orders_returned_quantity_check
    check (returned_quantity >= 0 and returned_quantity <= quantity);
exception
  when duplicate_object then null;
end $$;

create table if not exists order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  order_number int not null,
  product_id uuid references products(id) on delete set null,
  warehouse_id uuid references warehouses(id) on delete set null,
  quantity int not null check (quantity > 0),
  reason text,
  staff_id uuid,
  staff_name text,
  created_at timestamptz not null default now()
);
create index if not exists order_returns_order_idx on order_returns (order_id);
create index if not exists order_returns_number_idx on order_returns (order_number, created_at desc);

alter table order_returns enable row level security;
drop policy if exists "admin_read_order_returns" on order_returns;
create policy "admin_read_order_returns" on order_returns for select
  to authenticated using (is_admin());

-- p_items: [{"order_id": "<uuid>", "quantity": 2}, ...]
-- Возвращает, сколько штук вернулось всего. Любая ошибка (позиция не
-- отправлена, возвращают больше, чем осталось) отменяет весь возврат.
create or replace function return_order_lines(
  p_items jsonb,
  p_reason text,
  p_staff_id uuid,
  p_staff_name text
) returns int
language plpgsql
set search_path = public
as $$
declare
  item jsonb;
  line record;
  qty int;
  total int := 0;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::int;
    if qty is null or qty < 1 then
      raise exception 'invalid_quantity';
    end if;

    select id, order_number, product_id, warehouse_id, quantity, returned_quantity,
           status, stock_deducted_at
      into line
      from orders
     where id = (item->>'order_id')::uuid
       for update;

    if not found then
      raise exception 'order_not_found';
    end if;
    if line.stock_deducted_at is null or line.status = 'cancelled' then
      raise exception 'not_shipped';
    end if;
    if qty > line.quantity - line.returned_quantity then
      raise exception 'return_exceeds';
    end if;

    update orders set returned_quantity = returned_quantity + qty where id = line.id;

    if line.product_id is not null then
      update products set stock = stock + qty where id = line.product_id;
      -- Склад: только если строка остатка есть — так же, как при списании
      -- (списывалось тоже только с существующей строки).
      if line.warehouse_id is not null then
        update warehouse_stock set quantity = quantity + qty
         where warehouse_id = line.warehouse_id and product_id = line.product_id;
      end if;
    end if;

    insert into order_returns (order_id, order_number, product_id, warehouse_id, quantity, reason, staff_id, staff_name)
    values (line.id, line.order_number, line.product_id, line.warehouse_id, qty,
            nullif(trim(coalesce(p_reason, '')), ''), p_staff_id, p_staff_name);

    total := total + qty;
  end loop;
  return total;
end;
$$;

-- Вызывает только сервер (серверным ключом, после проверки, что это админ).
revoke execute on function return_order_lines(jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function return_order_lines(jsonb, text, uuid, text) to service_role;

alter table import_runs add column if not exists merged_at timestamptz;

-- Резерв товара под оформленные, но ещё не отправленные заказы.
--
-- Остаток (products.stock) по-прежнему списывается только при отправке
-- заказа. Но пока заказ собирают, его товар уже занят: на складе 25 шт,
-- первый покупатель заказал 20 — второму доступно только 5, хотя остаток
-- всё ещё 25.
--
-- Зарезервировано = сумма количества по строкам заказов, которые
--   - не отменены (status <> 'cancelled'),
--   - ещё не списаны со склада (stock_deducted_at is null — не отправлены).
-- Доступно = остаток − зарезервировано (не меньше нуля).
--
-- 1. reserved_stock() — резерв по товарам, у которых он есть (их единицы).
--    Витрина вычитает его из остатка: покупатель видит и может положить в
--    корзину только доступное.
-- 2. Триггер на orders — страховка в самой базе: строка заказа, для которой
--    доступного не хватает, не вставится (и количество в неотправленном
--    заказе не увеличится сверх доступного). Товар блокируется на время
--    проверки, так что два одновременных оформления не возьмут одно и то же.
--    Уже существующие заказы не проверяются: их можно двигать, уменьшать и
--    отправлять как раньше.
--
-- Порядок выкатки любой: без этого SQL витрина показывает полный остаток,
-- как раньше. Идемпотентно: можно запускать повторно.

create index if not exists orders_open_reservations_idx
  on orders (product_id)
  where stock_deducted_at is null and status <> 'cancelled';

-- Только суммы по товарам — чужие заказы отсюда не видны.
create or replace function reserved_stock()
returns table (product_id uuid, reserved int)
language sql
stable
security definer
set search_path = public
as $$
  select o.product_id, sum(o.quantity)::int as reserved
    from orders o
   where o.product_id is not null
     and o.stock_deducted_at is null
     and o.status <> 'cancelled'
   group by o.product_id
$$;

revoke execute on function reserved_stock() from public, anon;
grant execute on function reserved_stock() to authenticated, service_role;

create or replace function check_order_available_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock int;
  reserved_by_others int;
begin
  -- Не резервирует: без товара, отменённая или уже списанная строка.
  if new.product_id is null or new.status = 'cancelled' or new.stock_deducted_at is not null then
    return new;
  end if;
  -- Правка без увеличения (тот же товар, количество не выросло) — не проверяем,
  -- чтобы старые заказы можно было двигать и уменьшать как раньше.
  if tg_op = 'UPDATE'
     and old.product_id is not distinct from new.product_id
     and new.quantity <= old.quantity then
    return new;
  end if;

  select stock into current_stock from products where id = new.product_id for update;
  if not found then
    return new;
  end if;

  select coalesce(sum(quantity), 0) into reserved_by_others
    from orders
   where product_id = new.product_id
     and id <> new.id
     and stock_deducted_at is null
     and status <> 'cancelled';

  if new.quantity > greatest(0, current_stock - reserved_by_others) then
    raise exception 'insufficient_stock';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_check_available_stock on orders;
create trigger orders_check_available_stock
  before insert or update of quantity, product_id on orders
  for each row execute function check_order_available_stock();

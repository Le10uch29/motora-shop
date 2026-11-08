-- История заказов в корзине покупателя: «удалить из истории».
--
-- Заказ при этом НЕ удаляется: ставится hidden_by_customer_at, и история
-- покупателя (src/lib/orderHistory.ts) его больше не показывает. Админка,
-- аналитика и графики эту колонку не читают — для них заказ остаётся как был.
--
-- Пишет колонку только сервер (hideOrderHistoryAction, серверным ключом и
-- строго по заказам вошедшего пользователя) — в grant update для
-- authenticated она намеренно не добавлена.
--
-- Порядок выкатки любой: без колонки история показывается, просто без кнопок
-- удаления. Идемпотентно: можно запускать повторно.

alter table orders add column if not exists hidden_by_customer_at timestamptz;
create index if not exists orders_customer_history_idx
  on orders (customer_id, created_at desc) where hidden_by_customer_at is null;

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import {
  PROGRESSABLE_STATUSES,
  STOCK_DEDUCTION_STATUS,
  isStatusAtOrPast,
} from "./statusStyles";
import type { Locale } from "@/i18n/locales";

/** Страницы заказа адресуются его номером, а не заказчиком: один заказ —
 * одна страница и один инвойс. */
function revalidateOrderPaths(locale: Locale, orderNumber: number | string, id?: string) {
  revalidatePath(`/${locale}/admin/orders`);
  revalidatePath(`/${locale}/admin/orders/${orderNumber}`);
  revalidatePath(`/${locale}/admin/orders/${orderNumber}/invoice`);
  if (id) revalidatePath(`/${locale}/admin/orders/${orderNumber}/${id}`);
}

/** Progresses an order through fulfillment (new → gathering → shipped) —
 * open to admin and seller. Cancelling is a separate action, admin-only (see
 * cancelOrderAction and the RLS policies backing both).
 *
 * The first time an order reaches "shipped" *or beyond*, its quantity is
 * deducted both from the product's overall stock and from the specific
 * warehouse fulfilling it (whichever warehouse this update — or an earlier
 * one — attached to the order). "Or beyond" matters: the dropdown lets staff
 * jump straight from "new" to the last status, and an equality check on
 * "shipped" let that jump write off nothing at all — an order was marked done
 * while the stock stayed untouched. `stock_deducted_at` guards the other
 * direction, so moving back and forth never double-deducts. */
export async function updateOrderStatusAction(
  locale: Locale,
  id: string,
  orderNumber: number,
  status: (typeof PROGRESSABLE_STATUSES)[number],
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireStaff(locale);
  if (!PROGRESSABLE_STATUSES.includes(status)) {
    return { error: "invalid_status" };
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("quantity, product_id, warehouse_id, stock_deducted_at")
    .eq("id", id)
    .single();
  if (!order) return { error: "not_found" };

  // Stamps whichever seller/admin advanced the order with their own
  // warehouse — never chosen manually, and never cleared if the acting
  // staff member happens to have no warehouse assigned.
  const nextWarehouseId = actor.warehouseId ?? order.warehouse_id;
  const shouldDeductStock =
    isStatusAtOrPast(status, STOCK_DEDUCTION_STATUS) && !order.stock_deducted_at && order.product_id;

  const { error } = await admin
    .from("orders")
    .update({
      status,
      ...(nextWarehouseId ? { warehouse_id: nextWarehouseId } : {}),
      ...(shouldDeductStock ? { stock_deducted_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .neq("status", "cancelled");

  if (error) return { error: error.message };

  if (shouldDeductStock) {
    const { data: productRow } = await admin
      .from("products")
      .select("stock")
      .eq("id", order.product_id)
      .maybeSingle();
    if (productRow) {
      await admin
        .from("products")
        .update({ stock: Math.max(0, productRow.stock - order.quantity) })
        .eq("id", order.product_id);
    }

    if (nextWarehouseId) {
      const { data: stockRow } = await admin
        .from("warehouse_stock")
        .select("id, quantity")
        .eq("warehouse_id", nextWarehouseId)
        .eq("product_id", order.product_id)
        .maybeSingle();
      if (stockRow) {
        await admin
          .from("warehouse_stock")
          .update({ quantity: Math.max(0, stockRow.quantity - order.quantity) })
          .eq("id", stockRow.id);
      }
    }

    revalidatePath(`/${locale}/admin/products`);
    revalidatePath(`/${locale}/admin/warehouses`);
    if (nextWarehouseId) revalidatePath(`/${locale}/admin/warehouses/${nextWarehouseId}`);
  }

  await logAction(actor, "update", "order", `${label} → ${status}`, { entityId: id });
  revalidateOrderPaths(locale, orderNumber, id);
  return { error: null };
}

/** Moves every one of an orderer's active (non-cancelled) order lines to the
 * same next status at once — the top-level orders list shows one row per
 * customer/orderer, and a customer who ordered several different products
 * would otherwise need each line changed individually from their detail
 * page. Reuses updateOrderStatusAction per line so the stock-deduction
 * safety on "shipped" (and every other rule) stays in exactly one place. */
/** Переводит весь заказ в следующий статус разом.
 *
 * Заказ — это набор строк с общим номером, и двигают его целиком: собрали и
 * отправили всё оформление, а не отдельную позицию в нём.
 *
 * Запросов здесь ровно столько, сколько нужно, а не по пачке на строку: при
 * заказе из сотни позиций прежний цикл по строкам занимал минуты и не
 * доживал до конца на хостинге. Статус меняется одним UPDATE, отметка о
 * списании — вторым, а остатки товаров правятся параллельно.
 *
 * Правило списания то же, что и у отдельной строки: товар уходит со склада
 * один раз, при первом попадании в «отправлен» или дальше. */
export async function updateOrderStatusByNumberAction(
  locale: Locale,
  orderNumber: number,
  status: (typeof PROGRESSABLE_STATUSES)[number]
): Promise<{ error: string | null }> {
  const actor = await requireStaff(locale);
  if (!PROGRESSABLE_STATUSES.includes(status)) return { error: "invalid_status" };

  const admin = createAdminClient();
  const { data: lines } = await admin
    .from("orders")
    .select("id, quantity, product_id, warehouse_id, stock_deducted_at")
    .eq("order_number", orderNumber)
    .neq("status", "cancelled");
  if (!lines || lines.length === 0) return { error: "not_found" };

  // Склад проставляется автоматически — тот, что у двигающего заказ
  // сотрудника; если его нет, остаётся уже привязанный к заказу.
  const nextWarehouseId =
    actor.warehouseId ?? lines.find((line) => line.warehouse_id)?.warehouse_id ?? null;

  const { error } = await admin
    .from("orders")
    .update({ status, ...(nextWarehouseId ? { warehouse_id: nextWarehouseId } : {}) })
    .eq("order_number", orderNumber)
    .neq("status", "cancelled");
  if (error) return { error: error.message };

  const toDeduct = isStatusAtOrPast(status, STOCK_DEDUCTION_STATUS)
    ? lines.filter((line) => !line.stock_deducted_at && line.product_id)
    : [];

  if (toDeduct.length > 0) {
    // Отметка ставится только тем строкам, что ещё не списаны: у остальных
    // она уже есть, и перезаписывать её значит потерять время списания.
    await admin
      .from("orders")
      .update({ stock_deducted_at: new Date().toISOString() })
      .in("id", toDeduct.map((line) => line.id));

    // Один товар может встретиться в заказе дважды — списываем сумму.
    const neededByProduct = new Map<string, number>();
    for (const line of toDeduct) {
      neededByProduct.set(line.product_id!, (neededByProduct.get(line.product_id!) ?? 0) + line.quantity);
    }
    const productIds = [...neededByProduct.keys()];

    const { data: products } = await admin.from("products").select("id, stock").in("id", productIds);
    await Promise.all(
      (products ?? []).map((product) =>
        admin
          .from("products")
          .update({ stock: Math.max(0, product.stock - (neededByProduct.get(product.id) ?? 0)) })
          .eq("id", product.id)
      )
    );

    if (nextWarehouseId) {
      const { data: stockRows } = await admin
        .from("warehouse_stock")
        .select("id, product_id, quantity")
        .eq("warehouse_id", nextWarehouseId)
        .in("product_id", productIds);
      await Promise.all(
        (stockRows ?? []).map((row) =>
          admin
            .from("warehouse_stock")
            .update({ quantity: Math.max(0, row.quantity - (neededByProduct.get(row.product_id) ?? 0)) })
            .eq("id", row.id)
        )
      );
    }

    revalidatePath(`/${locale}/admin/products`);
    revalidatePath(`/${locale}/admin/warehouses`);
  }

  await logAction(actor, "update", "order", `№${orderNumber} → ${status}`, {
    details: { changedLines: String(lines.length) },
  });
  revalidateOrderPaths(locale, orderNumber);
  return { error: null };
}

/** Удаляет заказ целиком — одним запросом.
 *
 * Раньше здесь был цикл по позициям, и каждая удалялась отдельным действием:
 * выборка, удаление, запись в журнал и четыре пересчёта путей на строку. Для
 * заказа из сотни позиций это больше трёхсот обращений к базе подряд —
 * функция на хостинге успевала удалить несколько строк и умирала по
 * таймауту, а заказ оставался на месте, только похудевшим. Теперь это один
 * DELETE и одна запись в журнал на весь заказ.
 *
 * Ограничения по статусу нет: заказ заводят и ошибочно, и дважды, и тестом.
 * Право только у админа. Остаток на складе не возвращается — если заказ уже
 * уехал, товар действительно уехал. */
export async function deleteOrderByNumberAction(
  locale: Locale,
  orderNumber: number
): Promise<{ error: string | null; deleted: number }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const { data: lines } = await admin
    .from("orders")
    .select("id")
    .eq("order_number", orderNumber);
  const deleted = lines?.length ?? 0;
  if (deleted === 0) return { error: "not_found", deleted: 0 };

  const { error } = await admin.from("orders").delete().eq("order_number", orderNumber);
  if (error) return { error: error.message, deleted: 0 };

  await logAction(actor, "delete", "order", `№${orderNumber}`, {
    details: { deletedLines: String(deleted) },
  });
  revalidateOrderPaths(locale, orderNumber);
  return { error: null, deleted };
}

/** Меняет количество в строке заказа — доступно админу и продавцу, как и
 * правка цены: заказ часто уточняют по телефону уже после оформления.
 *
 * Остаток на складе здесь не трогается намеренно. Он списывается один раз,
 * при переходе заказа в «отправлен», и если правка пришла до этого момента —
 * спишется уже новое количество. Если заказ уже уехал, расхождение
 * исправляется в карточке товара, а не задним числом здесь: иначе одна и та
 * же правка то меняла бы склад, то нет, в зависимости от статуса. */
export async function updateOrderQuantityAction(
  locale: Locale,
  id: string,
  orderNumber: number,
  quantity: number,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireStaff(locale);
  const next = Math.floor(quantity);
  if (!Number.isFinite(next) || next < 1) return { error: "invalid_quantity" };

  const admin = createAdminClient();
  const { data: before } = await admin.from("orders").select("quantity").eq("id", id).single();
  if (!before) return { error: "not_found" };
  if (before.quantity === next) return { error: null };

  const { error } = await admin.from("orders").update({ quantity: next }).eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "update", "order", label, {
    entityId: id,
    details: { quantity: { before: String(before.quantity), after: String(next) } },
  });
  revalidateOrderPaths(locale, orderNumber, id);
  return { error: null };
}

/** Price override for one order line — open to admin and seller (matches the
 * seller's full permission set: view/search products, change order status,
 * change price — every change lands in the log). Pass null to clear the
 * override and fall back to price_at_order. */
export async function updateOrderDiscountAction(
  locale: Locale,
  id: string,
  orderNumber: number,
  discountedPrice: number | null,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireStaff(locale);

  const admin = createAdminClient();

  const { data: before } = await admin.from("orders").select("discounted_price").eq("id", id).single();

  const { error } = await admin
    .from("orders")
    .update({ discounted_price: discountedPrice })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAction(actor, "update", "order", label, {
    entityId: id,
    details: {
      discountedPrice: {
        before: before?.discounted_price != null ? String(before.discounted_price) : "",
        after: discountedPrice != null ? String(discountedPrice) : "",
      },
    },
  });
  revalidateOrderPaths(locale, orderNumber, id);
  return { error: null };
}

/** Добавляет товары в уже оформленный заказ — тот же номер, тот же инвойс.
 *
 * Покупатель часто вспоминает о забытой детали, пока заказ ещё собирают, и
 * второй заказ ради неё означал бы два инвойса и две отгрузки. Поэтому новые
 * строки получают номер существующего заказа (триггер номера явно переданный
 * не трогает), его заказчика, статус и склад. Цену и название, как и при
 * обычном оформлении, проставляет триггер orders_set_price_from_product.
 *
 * Только пока заказ не отправлен: на «отправлен» склад уже списан, и
 * добавленная после этого строка либо не списалась бы вовсе, либо требовала
 * бы отдельного списания задним числом.
 *
 * Товар, который в заказе уже есть, новой строкой не дублируется — к его
 * строке просто прибавляется количество. */
export async function addItemsToOrderAction(
  locale: Locale,
  orderNumber: number,
  items: { productId: string; quantity: number }[]
): Promise<{ error: string | null; orderNumber: number | null }> {
  const actor = await requireStaff(locale);
  if (items.length === 0) return { error: "empty_cart", orderNumber: null };

  const admin = createAdminClient();
  const { data: lines } = await admin
    .from("orders")
    .select("id, customer_id, product_id, quantity, status, warehouse_id, line_number")
    .eq("order_number", orderNumber);
  const active = (lines ?? []).filter((line) => line.status !== "cancelled");
  if (active.length === 0) return { error: "not_found", orderNumber: null };
  if (active.some((line) => isStatusAtOrPast(line.status, STOCK_DEDUCTION_STATUS))) {
    return { error: "order_already_shipped", orderNumber: null };
  }

  // Одно и то же может прийти дважды — складываем.
  const wanted = new Map<string, number>();
  for (const item of items) {
    const quantity = Math.max(1, Math.floor(item.quantity));
    if (!Number.isFinite(quantity)) continue;
    wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + quantity);
  }

  // Закончившийся товар в заказ не идёт — то же правило, что и при оформлении.
  const { data: products } = await admin
    .from("products")
    .select("id")
    .in("id", [...wanted.keys()])
    .gt("stock", 0);
  const orderable = new Set((products ?? []).map((product) => product.id));
  for (const productId of [...wanted.keys()]) {
    if (!orderable.has(productId)) wanted.delete(productId);
  }
  if (wanted.size === 0) return { error: "products_not_found", orderNumber: null };

  const first = active[0];
  const status = first.status;
  const warehouseId = active.find((line) => line.warehouse_id)?.warehouse_id ?? null;
  let nextLine = Math.max(0, ...(lines ?? []).map((line) => line.line_number ?? 0)) + 1;

  const updates: PromiseLike<{ error: { message: string } | null }>[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const [productId, quantity] of wanted) {
    const existing = active.find((line) => line.product_id === productId);
    if (existing) {
      updates.push(
        admin.from("orders").update({ quantity: existing.quantity + quantity }).eq("id", existing.id)
      );
    } else {
      rows.push({
        order_number: orderNumber,
        customer_id: first.customer_id,
        product_id: productId,
        quantity,
        status,
        line_number: nextLine++,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      });
    }
  }

  const results = await Promise.all([
    ...updates,
    ...(rows.length > 0 ? [admin.from("orders").insert(rows)] : []),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) return { error: failed.error.message, orderNumber: null };

  await logAction(actor, "update", "order", `№${orderNumber} + ${wanted.size}`, {
    details: {
      addedLines: String(rows.length),
      increasedLines: String(updates.length),
    },
  });
  revalidateOrderPaths(locale, orderNumber);
  revalidatePath(`/${locale}/admin`);
  return { error: null, orderNumber };
}

/** Безвозвратно удаляет одну строку заказа — только админ.
 *
 * Раньше удалять разрешалось лишь отменённые и отправленные: по замыслу —
 * чтобы не потерять заказ в работе, на деле — ошибочный «новый» заказ
 * оставался навсегда. Решение, что удалять, оставлено админу; след остаётся
 * в журнале. Остаток на складе при удалении не возвращается: если заказ уже
 * был отправлен, товар действительно уехал. */
export async function deleteOrderAction(
  locale: Locale,
  id: string,
  orderNumber: number,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("status").eq("id", id).single();
  if (!order) return { error: "not_found" };

  const { error } = await admin.from("orders").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "order", label, { entityId: id });
  revalidateOrderPaths(locale, orderNumber, id);
  return { error: null };
}

export async function cancelOrderAction(
  locale: Locale,
  id: string,
  orderNumber: number,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "cancelled");

  if (error) return { error: error.message };

  await logAction(actor, "delete", "order", label, { entityId: id });
  revalidateOrderPaths(locale, orderNumber, id);
  return { error: null };
}

import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/locales";

export type WarehouseRow = {
  id: string;
  name: string;
  address: string;
  productCount: number;
};

export async function getWarehouses(): Promise<WarehouseRow[]> {
  const supabase = await createClient();
  const [{ data: warehouses }, { data: stock }] = await Promise.all([
    supabase.from("warehouses").select("id, name, address").order("name"),
    supabase.from("warehouse_stock").select("warehouse_id"),
  ]);

  const countByWarehouse = new Map<string, number>();
  for (const row of stock ?? []) {
    countByWarehouse.set(row.warehouse_id, (countByWarehouse.get(row.warehouse_id) ?? 0) + 1);
  }

  return (warehouses ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    address: w.address ?? "",
    productCount: countByWarehouse.get(w.id) ?? 0,
  }));
}

export async function getWarehouseById(
  id: string
): Promise<{ id: string; name: string; address: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("id, name, address")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, address: data.address ?? "" };
}

export type WarehouseStockRow = {
  productId: string;
  productName: string;
  quantity: number;
};

type StockJoinRow = {
  product_id: string;
  quantity: number;
  products: { name: Record<string, string> } | { name: Record<string, string> }[] | null;
};

export async function getWarehouseStock(
  warehouseId: string,
  locale: Locale
): Promise<WarehouseStockRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("warehouse_stock")
    .select("product_id, quantity, products(name)")
    .eq("warehouse_id", warehouseId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as StockJoinRow[]).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      productId: row.product_id,
      productName: product?.name?.[locale] ?? product?.name?.ru ?? "",
      quantity: row.quantity,
    };
  });
}

export async function getWarehouseOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("warehouses").select("id, name").order("name");
  return data ?? [];
}

export async function getProductOptions(locale: Locale): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name")
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => ({ id: p.id, name: p.name?.[locale] ?? p.name?.ru ?? "" }));
}

/** productId -> (warehouseId -> quantity), for the products-list "warehouses" icon. */
export async function getProductStockMap(): Promise<Record<string, Record<string, number>>> {
  const supabase = await createClient();
  const { data } = await supabase.from("warehouse_stock").select("product_id, warehouse_id, quantity");

  const map: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    if (!map[row.product_id]) map[row.product_id] = {};
    map[row.product_id][row.warehouse_id] = row.quantity;
  }
  return map;
}

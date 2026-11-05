import type { createAdminClient } from "@/lib/supabase/admin";
import { chunk, type AppliedStock, type PlannedUpdate } from "./importSteps";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Запись запуска Excel-импорта в «Историю импортов» (таблицы import_runs,
 * import_run_items, import_run_stock — supabase/migrations/20261104_import_history.sql).
 *
 * Пишется ПОСЛЕ того, как товары записаны: created_at строки запуска (время
 * базы) служит границей — товар, изменённый позже неё, считается правленым
 * вручную, и откат его не трогает.
 *
 * Запись — страховка, а не часть импорта: если она не удалась (например,
 * таблиц ещё нет), импорт всё равно считается прошедшим, а вызывающий
 * получает предупреждение.
 */
export async function recordImportRun(
  admin: AdminClient,
  run: {
    brandId: string;
    brandName: string;
    warehouseId: string | null;
    warehouseName: string | null;
    fileName: string | null;
    staffId: string;
    staffName: string;
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    conflicts: number;
    stock: number;
  },
  createdItems: { id: string; code: string }[],
  updatedItems: PlannedUpdate[],
  appliedStock: AppliedStock[]
): Promise<{ runId: string | null; error: string | null }> {
  const { data, error } = await admin
    .from("import_runs")
    .insert({
      brand_id: run.brandId,
      brand_name: run.brandName,
      warehouse_id: run.warehouseId,
      warehouse_name: run.warehouseName,
      file_name: run.fileName,
      staff_id: run.staffId,
      staff_name: run.staffName,
      created_count: run.created,
      updated_count: run.updated,
      unchanged_count: run.unchanged,
      skipped_count: run.skipped,
      conflicts_count: run.conflicts,
      stock_count: run.stock,
    })
    .select("id")
    .single();
  if (error || !data) return { runId: null, error: error?.message ?? "import_run_not_saved" };
  const runId = data.id as string;

  const items = [
    ...createdItems.map((item) => ({
      run_id: runId,
      product_id: item.id,
      product_code: item.code,
      action: "created",
      previous: null,
    })),
    ...updatedItems.map((item) => ({
      run_id: runId,
      product_id: item.id,
      product_code: item.code,
      action: "updated",
      previous: item.previous,
    })),
  ];
  for (const group of chunk(items, 500)) {
    const { error: itemsError } = await admin.from("import_run_items").insert(group);
    if (itemsError) return { runId, error: itemsError.message };
  }

  const stockRows = appliedStock.map((row) => ({
    run_id: runId,
    product_id: row.productId,
    warehouse_id: row.warehouseId,
    quantity: row.quantity,
    previous_quantity: row.previousQuantity,
  }));
  for (const group of chunk(stockRows, 500)) {
    const { error: stockError } = await admin.from("import_run_stock").insert(group);
    if (stockError) return { runId, error: stockError.message };
  }

  return { runId, error: null };
}

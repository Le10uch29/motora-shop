import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentStaff } from "@/lib/auth";

export type LogAction = "create" | "update" | "delete";
export type LogEntityType = "staff" | "customer" | "brand" | "product" | "page" | "warehouse" | "order";

export async function logAction(
  actor: CurrentStaff,
  action: LogAction,
  entityType: LogEntityType,
  entityLabel: string,
  options?: { entityId?: string; details?: Record<string, unknown> }
) {
  const admin = createAdminClient();
  await admin.from("logs").insert({
    staff_id: actor.id,
    staff_name: `${actor.firstName} ${actor.lastName}`,
    action,
    entity_type: entityType,
    entity_label: entityLabel,
    entity_id: options?.entityId ?? null,
    details: options?.details ?? null,
  });
}

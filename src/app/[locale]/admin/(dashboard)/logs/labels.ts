import type { Dictionary } from "@/i18n/dictionary";

export function actionLabel(dict: Dictionary["admin"], action: string): string {
  if (action === "create") return dict.logActionCreate;
  if (action === "update") return dict.logActionUpdate;
  if (action === "delete") return dict.logActionDelete;
  return action;
}

/**
 * Роли сотрудников. Без серверных импортов — нужны и клиентским компонентам.
 *
 *  - admin — всё;
 *  - seller — заказы и просмотр товаров;
 *  - senior_seller — то же, что продавец, плюс покупатели: добавлять новых и
 *    менять им пароль.
 */
export type StaffRole = "admin" | "seller" | "senior_seller";

export const STAFF_ROLES: StaffRole[] = ["seller", "senior_seller", "admin"];

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as string[]).includes(value);
}

/** Читаемое название роли — для списков сотрудников и шапки панели. */
export function roleLabel(
  role: StaffRole,
  dict: { roleAdmin: string; roleSeller: string; roleSeniorSeller: string }
): string {
  if (role === "admin") return dict.roleAdmin;
  if (role === "senior_seller") return dict.roleSeniorSeller;
  return dict.roleSeller;
}

/** Кто может добавлять покупателей и менять им пароль: админ и старший продавец. */
export function canManageCustomers(role: StaffRole): boolean {
  return role === "admin" || role === "senior_seller";
}

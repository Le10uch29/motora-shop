/**
 * Роли сотрудников и что каждой можно. Без серверных импортов — нужны и
 * клиентским компонентам.
 *
 *  - seller (продавец): добавлять и редактировать товары, отправлять заказы
 *    (менять статус), менять количество и цену в уже оформленных заказах;
 *  - senior_seller (старший продавец): всё, что продавец, плюс добавлять
 *    продавцов, добавлять покупателей и менять покупателям пароль;
 *  - admin: всё.
 *
 * Права проверяются на сервере (lib/auth.ts — requireRole и действия); здесь
 * же они нужны интерфейсу, чтобы не показывать кнопки, которые всё равно не
 * сработают.
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

/** Добавлять и редактировать товары — любой сотрудник. Удаление, импорт
 * Excel, склады товара и подборки «Акций» — только админ. */
export function canEditProducts(role: StaffRole): boolean {
  return isStaffRole(role);
}

/** Добавлять покупателей и менять им пароль: админ и старший продавец. */
export function canManageCustomers(role: StaffRole): boolean {
  return role === "admin" || role === "senior_seller";
}

/** Раздел «Администрация»: видеть сотрудников и добавлять новых. */
export function canManageStaff(role: StaffRole): boolean {
  return role === "admin" || role === "senior_seller";
}

/** Какие роли этот сотрудник может выдавать — при добавлении сотрудника и
 * при назначении роли существующему пользователю. Старший продавец — только
 * продавца: поднять кого-то до своего уровня или до админа он не может. */
export function assignableRoles(role: StaffRole): StaffRole[] {
  if (role === "admin") return STAFF_ROLES;
  if (role === "senior_seller") return ["seller"];
  return [];
}

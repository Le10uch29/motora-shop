/**
 * Контакты магазина — в одном месте, а не разбросанные по страницам.
 *
 * Значения одинаковы во всех языках (номер, почта, код организации), поэтому
 * они здесь, а не в словарях: переводятся только подписи к ним.
 */
export const SHOP_CONTACTS = {
  phone: "+995577466611",
  email: "arazmotors@gmail.com",
  /** Идентификационный номер организации. */
  organizationIdNumber: "43434195006",
} as const;

/** Телефон без пробелов и скобок — для href="tel:". */
export const phoneHref = `tel:${SHOP_CONTACTS.phone}`;
export const emailHref = `mailto:${SHOP_CONTACTS.email}`;

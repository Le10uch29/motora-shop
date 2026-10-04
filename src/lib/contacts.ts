export const SHOP_CONTACTS = {
  phone: "+995577466611",
  email: "arazmotors@gmail.com",
  /** Идентификационный номер организации. */
  organizationIdNumber: "434195006",
} as const;

/** Телефон без пробелов и скобок — для href="tel:". */
export const phoneHref = `tel:${SHOP_CONTACTS.phone}`;
export const emailHref = `mailto:${SHOP_CONTACTS.email}`;

export const SITE_AUTHOR = {
  label: "Create By Shadow-Monarch",
  url: "https://elnur-portfolio.vercel.app/",
} as const;

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OrderForCustomerModal from "../../customers/OrderForCustomerModal";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/** «Добавить товар» в уже оформленный заказ: тот же поиск и корзина, что и при
 * заказе вместо покупателя, только товары дописываются в этот заказ. */
export default function AddItemsToOrderButton({
  locale,
  dict,
  orderNumber,
  orderer,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderNumber: number;
  orderer: { id: string; name: string; phone: string; organizationName: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-orange-500 px-4 py-1.5 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/40"
      >
        + {dict.orderAddItemsButton}
      </button>
      {open && (
        <OrderForCustomerModal
          locale={locale}
          dict={dict}
          customer={orderer}
          appendToOrder={orderNumber}
          onClose={() => setOpen(false)}
          onPlaced={() => router.refresh()}
        />
      )}
    </>
  );
}

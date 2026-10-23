"use client";

import { useState } from "react";
import CustomerFormModal, { type CustomerFormValues } from "../CustomerFormModal";
import CustomerPasswordModal from "../CustomerPasswordModal";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

const buttonClass =
  "w-fit rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300";

/** «Сменить пароль» — админу и старшему продавцу, «Редактировать» — только админу. */
export default function CustomerDetailActions({
  locale,
  dict,
  isAdmin,
  values,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  values: CustomerFormValues;
}) {
  const [open, setOpen] = useState<"edit" | "password" | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setOpen("password")} className={buttonClass}>
        {dict.actionChangePassword}
      </button>
      {isAdmin && (
        <button type="button" onClick={() => setOpen("edit")} className={buttonClass}>
          {dict.actionEdit}
        </button>
      )}

      {open === "edit" && (
        <CustomerFormModal
          locale={locale}
          dict={dict}
          mode="edit"
          initialValues={values}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "password" && (
        <CustomerPasswordModal
          locale={locale}
          dict={dict}
          customer={{ id: values.id, name: `${values.firstName} ${values.lastName}`.trim() }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import CustomerFormModal, { type CustomerFormValues } from "../CustomerFormModal";
import type { Dictionary } from "@/i18n/dictionary";

export default function CustomerDetailActions({
  locale,
  dict,
  values,
}: {
  locale: string;
  dict: Dictionary["admin"];
  values: CustomerFormValues;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
      >
        {dict.actionEdit}
      </button>

      {open && (
        <CustomerFormModal
          locale={locale}
          dict={dict}
          mode="edit"
          initialValues={values}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

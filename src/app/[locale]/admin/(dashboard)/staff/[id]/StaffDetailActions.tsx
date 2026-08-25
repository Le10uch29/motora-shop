"use client";

import { useState } from "react";
import StaffFormModal, { type StaffFormValues } from "../StaffFormModal";
import type { Dictionary } from "@/i18n/dictionary";

export default function StaffDetailActions({
  locale,
  dict,
  passwordLabel,
  values,
  warehouses,
}: {
  locale: string;
  dict: Dictionary["admin"];
  passwordLabel: string;
  values: StaffFormValues;
  warehouses: { id: string; name: string }[];
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
        <StaffFormModal
          locale={locale}
          dict={dict}
          passwordLabel={passwordLabel}
          mode="edit"
          initialValues={values}
          warehouses={warehouses}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

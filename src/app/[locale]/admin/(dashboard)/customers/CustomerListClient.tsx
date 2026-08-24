"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { deleteCustomerAction } from "./actions";
import CustomerFormModal, { type CustomerFormValues } from "./CustomerFormModal";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export type CustomerRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  idCardNumber: string;
  organizationName: string;
  address: string;
  postalCode: string;
  city: string;
  photoUrl: string | null;
};

export default function CustomerListClient({
  locale,
  dict,
  customers,
  emptyMessage,
  searchSlot,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  customers: CustomerRow[];
  emptyMessage: string;
  searchSlot?: ReactNode;
}) {
  const [modal, setModal] = useState<{ mode: "create" | "edit"; values?: CustomerFormValues } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(row: CustomerRow) {
    if (!window.confirm(dict.confirmDeleteCustomer)) return;
    startTransition(async () => {
      const result = await deleteCustomerAction(locale, row.id, `${row.firstName} ${row.lastName}`);
      setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.customersTitle}
        </h1>
        <button
          type="button"
          onClick={() =>
            setModal({
              mode: "create",
              values: {
                id: "",
                email: "",
                firstName: "",
                lastName: "",
                phone: "",
                idCardNumber: "",
                organizationName: "",
                address: "",
                postalCode: "",
                city: "",
                photoUrl: null,
              },
            })
          }
          className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          {dict.addCustomer}
        </button>
      </div>

      {searchSlot}

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {customers.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">{dict.tableName}</th>
                <th className="px-4 py-3 font-medium">{dict.tableOrganization}</th>
                <th className="px-4 py-3 font-medium">{dict.tablePhone}</th>
                <th className="px-4 py-3 font-medium">{dict.tableEmail}</th>
                <th className="px-4 py-3 font-medium">{dict.idCardLabel}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {customers.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    {row.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.organizationName}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.phone}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.email}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.idCardNumber}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <Link
                        href={`/${locale}/admin/customers/${row.id}`}
                        className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {dict.actionDetails}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", values: row })}
                        className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {dict.actionEdit}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDelete(row)}
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-500 disabled:opacity-60 dark:border-red-900"
                      >
                        {dict.actionDelete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CustomerFormModal
          locale={locale}
          dict={dict}
          mode={modal.mode}
          initialValues={modal.values}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomerAction } from "./actions";
import CustomerFormModal, { type CustomerFormValues } from "./CustomerFormModal";
import OrderForCustomerModal from "./OrderForCustomerModal";
import { RowActionLink, RowActionButton, EyeIcon, PencilIcon, TrashIcon } from "@/components/admin/RowActions";
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
  organizationIdNumber: string;
  address: string;
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
  // Покупатель, за которого сейчас собирают заказ.
  const [orderFor, setOrderFor] = useState<CustomerRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
                organizationIdNumber: "",
                address: "",
                city: "",
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
                  {/* На месте бывшего аватара — кнопка «заказать вместо
                      покупателя». Фотографии покупателей из проекта убраны, и
                      столбец стоял пустыми кружками; сюда же она и просится,
                      рядом с именем того, за кого оформляют. */}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title={dict.orderForCustomerButton}
                      aria-label={`${dict.orderForCustomerButton}: ${row.firstName} ${row.lastName}`}
                      onClick={() => setOrderFor(row)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-400"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <circle cx="9" cy="20" r="1.3" />
                        <circle cx="17" cy="20" r="1.3" />
                        <path d="M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L20 8H6" />
                      </svg>
                    </button>
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
                      <RowActionLink href={`/${locale}/admin/customers/${row.id}`} label={dict.actionDetails}>
                        <EyeIcon />
                      </RowActionLink>
                      <RowActionButton label={dict.actionEdit} onClick={() => setModal({ mode: "edit", values: row })}>
                        <PencilIcon />
                      </RowActionButton>
                      <RowActionButton
                        label={dict.actionDelete}
                        disabled={pending}
                        danger
                        onClick={() => handleDelete(row)}
                      >
                        <TrashIcon />
                      </RowActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orderFor && (
        <OrderForCustomerModal
          locale={locale}
          dict={dict}
          customer={{
            id: orderFor.id,
            name: `${orderFor.firstName} ${orderFor.lastName}`.trim(),
            phone: orderFor.phone,
            organizationName: orderFor.organizationName,
          }}
          onClose={() => setOrderFor(null)}
          onPlaced={() => router.refresh()}
        />
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

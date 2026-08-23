"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { deleteStaffAction } from "./actions";
import StaffFormModal, { type StaffFormValues } from "./StaffFormModal";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export type StaffRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  idCardNumber: string;
  role: "admin" | "seller";
};

export default function StaffListClient({
  locale,
  dict,
  passwordLabel,
  currentStaffId,
  staff,
  title,
  defaultRole,
  emptyMessage,
  searchSlot,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  passwordLabel: string;
  currentStaffId: string;
  staff: StaffRow[];
  title: string;
  defaultRole: "admin" | "seller";
  emptyMessage: string;
  searchSlot?: ReactNode;
}) {
  const [modal, setModal] = useState<{ mode: "create" | "edit"; values?: StaffFormValues } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFire(row: StaffRow) {
    if (!window.confirm(dict.confirmFire)) return;
    startTransition(async () => {
      const result = await deleteStaffAction(locale, row.id, `${row.firstName} ${row.lastName}`);
      setDeleteError(result.error === "cannot_fire_self" ? dict.cannotFireSelf : result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        <button
          type="button"
          onClick={() =>
            setModal({
              mode: "create",
              values: { id: "", email: "", firstName: "", lastName: "", phone: "", idCardNumber: "", role: defaultRole },
            })
          }
          className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          {dict.addStaff}
        </button>
      </div>

      {searchSlot}

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {staff.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.tableName}</th>
                <th className="px-4 py-3 font-medium">{dict.tablePhone}</th>
                <th className="px-4 py-3 font-medium">{dict.tableEmail}</th>
                <th className="px-4 py-3 font-medium">{dict.tableId}</th>
                <th className="px-4 py-3 font-medium">{dict.tableRole}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {staff.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.phone || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.email}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{row.id}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.role === "admin" ? dict.roleAdmin : dict.roleSeller}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <Link
                        href={`/${locale}/admin/staff/${row.id}`}
                        className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {dict.actionDetails}
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            mode: "edit",
                            values: {
                              id: row.id,
                              email: row.email,
                              firstName: row.firstName,
                              lastName: row.lastName,
                              phone: row.phone,
                              idCardNumber: row.idCardNumber,
                              role: row.role,
                            },
                          })
                        }
                        className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {dict.actionEdit}
                      </button>
                      {row.id !== currentStaffId && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleFire(row)}
                          className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-500 disabled:opacity-60 dark:border-red-900"
                        >
                          {dict.actionFire}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <StaffFormModal
          locale={locale}
          dict={dict}
          passwordLabel={passwordLabel}
          mode={modal.mode}
          initialValues={modal.values}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

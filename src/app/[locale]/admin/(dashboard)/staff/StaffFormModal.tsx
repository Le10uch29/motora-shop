"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createStaffAction, updateStaffAction, type StaffActionState } from "./actions";
import type { StaffRole } from "@/lib/auth";
import type { Dictionary } from "@/i18n/dictionary";

export type StaffFormValues = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  idCardNumber: string;
  role: StaffRole;
  warehouseId: string;
};

const EMPTY_VALUES: StaffFormValues = {
  id: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  idCardNumber: "",
  role: "seller",
  warehouseId: "",
};

const initialState: StaffActionState = { error: null };

function errorText(code: string | null, dict: Dictionary["admin"]): string | null {
  if (!code) return null;
  if (code === "cannot_fire_self") return dict.cannotFireSelf;
  if (code === "password_too_short") return dict.passwordTooShort;
  return code;
}

export default function StaffFormModal({
  locale,
  dict,
  passwordLabel,
  mode,
  initialValues,
  warehouses,
  onClose,
}: {
  locale: string;
  dict: Dictionary["admin"];
  passwordLabel: string;
  mode: "create" | "edit";
  initialValues?: StaffFormValues;
  warehouses: { id: string; name: string }[];
  onClose: () => void;
}) {
  const action = mode === "create" ? createStaffAction : updateStaffAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [submitted, setSubmitted] = useState(false);
  const values = initialValues ?? EMPTY_VALUES;

  useEffect(() => {
    if (submitted && !pending && !state.error) onClose();
  }, [submitted, pending, state.error, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form
        action={formAction}
        onSubmit={() => setSubmitted(true)}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {mode === "create" ? dict.addStaff : dict.actionEdit}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <input type="hidden" name="locale" value={locale} />
        {mode === "edit" && <input type="hidden" name="id" value={values.id} />}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="staff-firstName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.firstNameLabel}
            </label>
            <input
              id="staff-firstName"
              name="firstName"
              required
              defaultValue={values.firstName}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="staff-lastName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.lastNameLabel}
            </label>
            <input
              id="staff-lastName"
              name="lastName"
              required
              defaultValue={values.lastName}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.phoneLabel}
          </label>
          <input
            id="staff-phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id="staff-email"
            name="email"
            type="email"
            defaultValue={values.email}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <span className="text-xs text-zinc-500">{dict.phoneOrEmailHint}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-idCard" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.idCardLabel}
          </label>
          <input
            id="staff-idCard"
            name="idCardNumber"
            defaultValue={values.idCardNumber}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {mode === "create" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="staff-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {passwordLabel}
            </label>
            <input
              id="staff-password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="staff-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.resetPasswordLabel}
            </label>
            <input
              id="staff-password"
              name="password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              placeholder={dict.resetPasswordHint}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.roleLabel}</span>
          <select
            name="role"
            defaultValue={values.role}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="seller">{dict.roleSeller}</option>
            <option value="admin">{dict.roleAdmin}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.warehouseAssignedLabel}
          </span>
          <select
            name="warehouseId"
            defaultValue={values.warehouseId}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        {state.error && <p className="text-sm text-red-600">{errorText(state.error, dict)}</p>}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
          >
            {mode === "create" ? dict.create : dict.save}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

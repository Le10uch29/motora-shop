"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerActionState,
} from "./actions";
import type { Dictionary } from "@/i18n/dictionary";

export type CustomerFormValues = {
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

const EMPTY_VALUES: CustomerFormValues = {
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
};

const initialState: CustomerActionState = { error: null, createdPassword: null, deliveryMethod: null };

function errorText(code: string | null, dict: Dictionary["admin"]): string | null {
  if (!code) return null;
  if (code === "password_too_short") return dict.passwordTooShort;
  return code;
}

export default function CustomerFormModal({
  locale,
  dict,
  mode,
  initialValues,
  onClose,
}: {
  locale: string;
  dict: Dictionary["admin"];
  mode: "create" | "edit";
  initialValues?: CustomerFormValues;
  onClose: () => void;
}) {
  const action = mode === "create" ? createCustomerAction : updateCustomerAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [submitted, setSubmitted] = useState(false);
  const values = initialValues ?? EMPTY_VALUES;

  useEffect(() => {
    if (!submitted || pending || state.error) return;
    // Edit mode has nothing more to show — close right away. Create mode
    // stays open below to reveal the generated password.
    if (mode === "edit") onClose();
  }, [submitted, pending, state.error, mode, onClose]);

  if (mode === "create" && state.createdPassword) {
    return createPortal(
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
        <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.tempPasswordTitle}</h2>
          <p className="text-sm text-zinc-500">{dict.tempPasswordHint}</p>
          <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {state.deliveryMethod === "phone"
                ? dict.passwordDeliverySms
                : state.deliveryMethod === "email"
                  ? dict.passwordDeliveryEmail
                  : dict.passwordDeliveryScreen}
            </span>
            <span className="select-all font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {state.createdPassword}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            {dict.close}
          </button>
        </div>
      </div>,
      document.body
    );
  }

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
            {mode === "create" ? dict.addCustomer : dict.actionEdit}
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
            <label htmlFor="customer-firstName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.firstNameLabel}
            </label>
            <input
              id="customer-firstName"
              name="firstName"
              required
              defaultValue={values.firstName}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-lastName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.lastNameLabel}
            </label>
            <input
              id="customer-lastName"
              name="lastName"
              required
              defaultValue={values.lastName}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-organizationName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.organizationNameLabel}
          </label>
          <input
            id="customer-organizationName"
            name="organizationName"
            required
            placeholder={dict.organizationNamePlaceholder}
            defaultValue={values.organizationName}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.phoneLabel}
          </label>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            required
            defaultValue={values.phone}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {mode === "create" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="customer-email"
              name="email"
              type="email"
              required
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
            <span className="text-sm text-zinc-500">{values.email}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-idCard" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.idCardLabel}
          </label>
          <input
            id="customer-idCard"
            name="idCardNumber"
            required
            defaultValue={values.idCardNumber}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-address" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.addressLabel}
          </label>
          <input
            id="customer-address"
            name="address"
            required
            defaultValue={values.address}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-city" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.cityLabel}
            </label>
            <input
              id="customer-city"
              name="city"
              required
              defaultValue={values.city}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-postalCode" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.postalCodeLabel}
            </label>
            <input
              id="customer-postalCode"
              name="postalCode"
              required
              defaultValue={values.postalCode}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-photo" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.photoLabel}
          </label>
          {values.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={values.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          )}
          <input
            id="customer-photo"
            name="photo"
            type="file"
            accept="image/*"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          />
        </div>

        {mode === "create" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.passwordDeliveryLabel}</span>
            <select
              name="deliveryMethod"
              defaultValue="screen"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="screen">{dict.passwordDeliveryScreen}</option>
              <option value="email">{dict.passwordDeliveryEmail}</option>
              <option value="phone">{dict.passwordDeliverySms}</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {dict.resetPasswordLabel}
            </label>
            <input
              id="customer-password"
              name="password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              placeholder={dict.resetPasswordHint}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        )}

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

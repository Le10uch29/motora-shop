"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { assignStaffRoleAction, searchUsersForStaffAction, type ExistingUser } from "./actions";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { roleLabel, type StaffRole } from "@/lib/roles";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

const SEARCH_DEBOUNCE_MS = 280;

function errorText(code: string, dict: Dictionary["admin"]): string {
  if (code === "role_not_allowed") return dict.roleNotAllowed;
  if (code === "already_staff") return dict.alreadyStaff;
  return code;
}

/**
 * Назначить роль сотрудника уже существующему пользователю — например,
 * покупателю, который пришёл работать продавцом. Новая учётная запись не
 * создаётся: он входит тем же логином и паролем и теперь видит панель.
 */
export default function AssignRoleModal({
  locale,
  dict,
  roles,
  warehouses,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  roles: StaffRole[];
  warehouses: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExistingUser[]>([]);
  const [selected, setSelected] = useState<ExistingUser | null>(null);
  const [role, setRole] = useState<StaffRole>(roles[0] ?? "seller");
  const [warehouseId, setWarehouseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEscapeKey(onClose);

  const requestIdRef = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(
      () => {
        if (trimmed.length < 2) {
          setResults([]);
          return;
        }
        searchUsersForStaffAction(locale, trimmed).then((found) => {
          if (requestIdRef.current === requestId) setResults(found);
        });
      },
      trimmed.length < 2 ? 0 : SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [query, locale]);

  function submit() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await assignStaffRoleAction(locale, selected.id, role, warehouseId || null);
      if (result.error) {
        setError(errorText(result.error, dict));
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const selectClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.assignRoleTitle}</h2>
          <p className="text-sm text-zinc-500">{dict.assignRoleHint}</p>
        </div>

        {selected ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 dark:border-orange-900 dark:bg-orange-950/30">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{selected.name}</span>
              <span className="text-xs text-zinc-500">
                {[selected.organizationName, selected.phone].filter(Boolean).join(" · ")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-xs font-medium text-orange-600 hover:underline"
            >
              {dict.assignRoleChange}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={dict.assignRoleSearchPlaceholder}
              aria-label={dict.assignRoleSearchPlaceholder}
              className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            {query.trim().length >= 2 && results.length === 0 ? (
              <p className="px-1 text-sm text-zinc-500">{dict.noResults}</p>
            ) : (
              <ul className="flex max-h-64 flex-col divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 empty:hidden dark:divide-zinc-800 dark:border-zinc-800">
                {results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(user)}
                      className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.name}</span>
                      <span className="text-xs text-zinc-500">
                        {[user.organizationName, user.phone].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.roleLabel}
            <select value={role} onChange={(event) => setRole(event.target.value as StaffRole)} className={selectClass}>
              {roles.map((option) => (
                <option key={option} value={option}>
                  {roleLabel(option, dict)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.warehouseAssignedLabel}
            <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={selectClass}>
              <option value="">—</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.cancel}
          </button>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={submit}
            className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dict.assignRoleSubmit}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

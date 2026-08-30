"use client";

import { useState, useTransition } from "react";
import { deleteBrandAction } from "./actions";
import BrandFormModal, { type BrandFormValues } from "./BrandFormModal";
import { RowActionButton, PencilIcon, TrashIcon } from "@/components/admin/RowActions";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export type BrandRow = {
  id: string;
  slug: string;
  name: string;
  initials: string | null;
  logoUrl: string | null;
  badgeLogoUrl: string | null;
};

export default function BrandsListClient({
  locale,
  dict,
  isAdmin,
  brands,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  brands: BrandRow[];
}) {
  const [modal, setModal] = useState<{ mode: "create" | "edit"; values?: BrandFormValues } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(row: BrandRow) {
    if (!window.confirm(dict.confirmDeleteBrand)) return;
    startTransition(async () => {
      const result = await deleteBrandAction(locale, row.id, row.name);
      setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.brandsTitle}
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            {dict.addBrand}
          </button>
        )}
      </div>

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <div
            key={brand.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt={brand.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{brand.name}</span>
                <span className="text-xs text-zinc-400">
                  {brand.slug}
                  {brand.initials ? ` · ${brand.initials}` : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                {brand.badgeLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.badgeLogoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-zinc-400">—</span>
                )}
              </div>
              <span>{dict.brandBadgeLogoLabel}</span>
            </div>

            {isAdmin && (
              <div className="mt-auto flex items-center gap-2">
                <RowActionButton
                  label={dict.actionEdit}
                  onClick={() =>
                    setModal({
                      mode: "edit",
                      values: {
                        id: brand.id,
                        name: brand.name,
                        initials: brand.initials,
                        logoUrl: brand.logoUrl,
                        badgeLogoUrl: brand.badgeLogoUrl,
                      },
                    })
                  }
                >
                  <PencilIcon />
                </RowActionButton>
                <RowActionButton
                  label={dict.actionDelete}
                  disabled={pending}
                  danger
                  onClick={() => handleDelete(brand)}
                >
                  <TrashIcon />
                </RowActionButton>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <BrandFormModal
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

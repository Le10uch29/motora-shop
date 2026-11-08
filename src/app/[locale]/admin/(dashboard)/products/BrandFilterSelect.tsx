"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Фильтр списка товаров по бренду. Живёт в адресе (?brand=…), как поиск и
 * остальные фильтры, и работает по всему каталогу, а не по текущей странице. */
export default function BrandFilterSelect({
  brands,
  value,
  label,
  allLabel,
}: {
  brands: { id: string; name: string }[];
  value: string | null;
  label: string;
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("brand", next);
    else params.delete("brand");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => change(e.target.value)}
        className={`rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-zinc-900 ${
          value
            ? "border-orange-500 text-orange-700 dark:text-orange-400"
            : "border-zinc-200 text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        }`}
      >
        <option value="">{allLabel}</option>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
    </label>
  );
}

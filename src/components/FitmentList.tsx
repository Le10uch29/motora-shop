import { Fragment } from "react";
import { makeLabel } from "@/lib/products";
import { fitmentEngines, formatFitmentYears, type Fitment } from "@/lib/fitments";
import type { Locale } from "@/i18n/locales";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/** The vehicles a part fits, as "Марка:", "Модель:", "Год:" and — when an
 * `engine` label is given — "Двигатель:" rows with every distinct value stacked
 * under the one before — shared by the product card and the product page so
 * both read the same. A row with nothing to show (a part with no model, or no
 * year given, say) is left out. */
export default function FitmentList({
  fitments,
  locale,
  labels,
  className = "",
}: {
  fitments: Fitment[];
  locale: Locale;
  /** `engine` — только там, где двигатели нужны (страница товара): на
   * карточке каталога список «модель + объём» был бы слишком длинным. */
  labels: { make: string; model: string; year: string; engine?: string };
  className?: string;
}) {
  const rows: [string, string[]][] = [
    [labels.make, unique(fitments.map((f) => makeLabel(f.make, locale)))],
    [labels.model, unique(fitments.map((f) => f.model))],
    [labels.year, unique(fitments.map(formatFitmentYears))],
    ...(labels.engine ? [[labels.engine, fitmentEngines(fitments)] as [string, string[]]] : []),
  ];

  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 ${className}`}>
      {rows
        .filter(([, values]) => values.length > 0)
        .map(([label, values]) => (
          <Fragment key={label}>
            <dt className="text-zinc-500">{label}:</dt>
            <dd className="flex flex-col font-medium text-zinc-900 dark:text-zinc-50">
              {values.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </dd>
          </Fragment>
        ))}
    </dl>
  );
}

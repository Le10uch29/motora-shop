import Link from "next/link";

export type BarItem = {
  label: string;
  value: number;
  /** Подпись справа — сумма, число заказов и т.п. Необязательна. */
  note?: string;
  href?: string;
};

/**
 * Горизонтальные полосы: категории, марки, города.
 *
 * Для такого вида данных они читаются лучше кольцевой диаграммы — названия
 * видны целиком, а не в легенде, и список спокойно растёт до десятка строк.
 * Доля считается от максимума, а не от суммы: сравнивают здесь между собой.
 */
export default function BarList({ items, totalLabel }: { items: BarItem[]; totalLabel?: string }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-500">
                {item.note ?? item.value.toLocaleString("ru-RU")}
                {total > 0 && <span className="ml-2 text-zinc-400">{share}%</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </div>
          </>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className="group flex flex-col gap-1.5">
            {row}
          </Link>
        ) : (
          <div key={item.label} className="flex flex-col gap-1.5">
            {row}
          </div>
        );
      })}

      {totalLabel && <p className="pt-1 text-xs text-zinc-400">{totalLabel}</p>}
    </div>
  );
}

import Link from "next/link";

export type TabOption = { value: string; label: string };

/**
 * Переключатели периода и метрики.
 *
 * Это ссылки, а не кнопки с состоянием: период живёт в адресе страницы,
 * поэтому дашборд остаётся серверным, выбор переживает перезагрузку и им можно
 * поделиться. Клиентского JS здесь нет вообще.
 */
export default function PeriodTabs({
  options,
  active,
  hrefFor,
}: {
  options: TabOption[];
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
      {options.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            option.value === active
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-zinc-500 hover:text-orange-600 dark:text-zinc-400"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

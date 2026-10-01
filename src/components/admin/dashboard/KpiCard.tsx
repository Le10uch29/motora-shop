import Link from "next/link";
import type { ReactNode } from "react";

export type KpiTone = "neutral" | "good" | "warn" | "bad" | "info";

const toneValue: Record<KpiTone, string> = {
  neutral: "text-zinc-900 dark:text-zinc-50",
  good: "text-emerald-600 dark:text-emerald-500",
  warn: "text-amber-600 dark:text-amber-500",
  bad: "text-red-600 dark:text-red-500",
  info: "text-blue-600 dark:text-blue-500",
};

/**
 * Плитка показателя. Кликабельна, когда есть куда вести — иначе остаётся
 * просто числом: ссылка в никуда хуже её отсутствия.
 *
 * `value === null` означает «источника данных нет» и печатает «Нет данных»,
 * а не ноль: ноль — это тоже утверждение, и неправдивое.
 */
export default function KpiCard({
  label,
  value,
  tone = "neutral",
  href,
  icon,
  noDataLabel,
}: {
  label: string;
  value: number | null;
  tone?: KpiTone;
  href?: string;
  icon?: ReactNode;
  noDataLabel: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        {icon && <span className="shrink-0 text-zinc-300 dark:text-zinc-600">{icon}</span>}
      </div>
      {value === null ? (
        <span className="text-base font-medium text-zinc-400">— {noDataLabel}</span>
      ) : (
        <span className={`text-2xl font-bold tabular-nums sm:text-3xl ${toneValue[tone]}`}>
          {value.toLocaleString("ru-RU")}
        </span>
      )}
    </>
  );

  const shell =
    "flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900";

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link
      href={href}
      className={`${shell} transition-colors hover:border-orange-500 dark:hover:border-orange-500`}
    >
      {body}
    </Link>
  );
}

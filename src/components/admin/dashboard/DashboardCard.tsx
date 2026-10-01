import Link from "next/link";
import type { ReactNode } from "react";

/** Карточка-секция дашборда: заголовок, необязательная ссылка справа и тело.
 * Один каркас на все блоки, чтобы отступы и рамки совпадали. */
export default function DashboardCard({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-black/5 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {icon}
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-sm font-medium text-orange-600 transition-colors hover:text-orange-500"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Единый вид «здесь пока нечего показать» — вместо выдуманных чисел. */
export function EmptyState({ text }: { text: string }) {
  return (
    <p className="flex min-h-24 items-center justify-center rounded-xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-950/40">
      {text}
    </p>
  );
}

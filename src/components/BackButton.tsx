"use client";

import { useRouter } from "next/navigation";

/**
 * Возврат на предыдущую страницу.
 *
 * Стоит слева, в одной строке с хлебными крошками: «назад» и «где я» —
 * это один и тот же вопрос, и отвечать на него удобнее в одном месте.
 * Справа сверху у магазина уже живут поиск, корзина и меню — кнопка там
 * конкурировала бы с ними и на телефоне попадала бы под большой палец
 * рядом с корзиной.
 *
 * Если истории нет (страницу открыли по прямой ссылке), router.back()
 * никуда не уведёт — поэтому рядом всегда есть крошка «Главная».
 */
export default function BackButton({ label }: { label: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}

"use client";

import { useState } from "react";

export type QuantityLabels = {
  decreaseAria: string;
  increaseAria: string;
  inputAria: string;
};

/**
 * Количество товара: минус, поле для ввода и плюс.
 *
 * Поле именно вводимое, а не подпись: за сотней штук никто не будет жать «+»
 * сто раз. Клик по нему выделяет число целиком, чтобы сразу набрать своё.
 *
 * `variant` — две формы, которые уже были на сайте: "pill" (кнопки внутри
 * одной скруглённой рамки, карточка товара) и "separate" (две отдельные
 * круглые кнопки, страница товара и корзина).
 */
export default function QuantityField({
  value,
  onChange,
  min = 1,
  max,
  labels,
  variant = "separate",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  /** Потолок, обычно остаток на складе. Без него число не ограничено сверху. */
  max?: number;
  labels: QuantityLabels;
  variant?: "pill" | "separate";
}) {
  // Пока в поле печатают, оно живёт своим значением: без этого нельзя стереть
  // число, чтобы набрать новое — пустая строка тут же превращалась бы обратно.
  const [draft, setDraft] = useState<string | null>(null);

  function clamp(next: number): number {
    return Math.min(Math.max(next, min), max ?? Number.MAX_SAFE_INTEGER);
  }

  function handleInput(raw: string) {
    // Только цифры: минус, пробелы и "e" в количестве штук смысла не имеют, а
    // type="number" пропускает их все и ещё рисует свои стрелки рядом с нашими.
    const digits = raw.replace(/\D+/g, "");
    if (!digits) {
      setDraft("");
      return;
    }
    const next = clamp(Number(digits));
    setDraft(String(next));
    onChange(next);
  }

  const pill = variant === "pill";
  const buttonClass = pill
    ? "flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300"
    : "flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300";

  return (
    <div
      className={
        pill
          ? "flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700"
          : "flex items-center gap-2"
      }
    >
      <button
        type="button"
        aria-label={labels.decreaseAria}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className={buttonClass}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={labels.inputAria}
        value={draft ?? String(value)}
        onChange={(event) => handleInput(event.target.value)}
        // Клик по полю выделяет число целиком — сразу набирается своё, без
        // предварительного стирания.
        onFocus={(event) => event.target.select()}
        onBlur={() => setDraft(null)}
        // Поле количества на карточке живёт внутри формы поиска в шапке, и Enter
        // в нём отправлял бы поиск вместо подтверждения числа.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className={`bg-transparent text-center font-medium tabular-nums text-zinc-900 outline-none dark:text-zinc-50 ${
          pill ? "w-9 text-sm" : "w-10"
        }`}
      />
      <button
        type="button"
        aria-label={labels.increaseAria}
        onClick={() => onChange(clamp(value + 1))}
        disabled={max !== undefined && value >= max}
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}

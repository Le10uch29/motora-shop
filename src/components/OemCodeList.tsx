"use client";

import { useEffect, useState } from "react";

/** Сколько держится отметка «Скопировано» после нажатия. */
const COPIED_MS = 1500;

/**
 * Все OEM-коды товара столбиком, каждый со своей кнопкой «копировать», и
 * кнопка «скопировать все» у заголовка. По OEM-номеру ищут деталь у других
 * поставщиков и сверяют с каталогом производителя — переписывать его руками
 * долго и легко ошибиться в цифре.
 */
export default function OemCodeList({
  codes,
  labels,
}: {
  codes: string[];
  labels: { title: string; copyCode: string; copyAll: string; copied: string };
}) {
  /** Что скопировано последним: индекс кода или "all". */
  const [copied, setCopied] = useState<number | "all" | null>(null);

  useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(text: string, which: number | "all") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
    } catch {
      // Буфер обмена недоступен (не https, запрет браузера) — молча ничего.
    }
  }

  if (codes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{labels.title}</span>
        {codes.length > 1 && (
          <CopyButton
            label={labels.copyAll}
            copiedLabel={labels.copied}
            copied={copied === "all"}
            onClick={() => copy(codes.join("\n"), "all")}
          />
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {codes.map((code, index) => (
          <li key={code} className="flex items-center justify-between gap-2">
            <span className="min-w-0 select-all break-all font-mono text-sm text-zinc-900 dark:text-zinc-50">
              {code}
            </span>
            <CopyButton
              label={`${labels.copyCode} ${code}`}
              copiedLabel={labels.copied}
              copied={copied === index}
              onClick={() => copy(code, index)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyButton({
  label,
  copiedLabel,
  copied,
  onClick,
}: {
  label: string;
  copiedLabel: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
        copied
          ? "text-emerald-600 dark:text-emerald-500"
          : "text-zinc-400 hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-800"
      }`}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      )}
    </button>
  );
}

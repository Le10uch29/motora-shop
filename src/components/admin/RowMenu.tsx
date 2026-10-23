"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type RowMenuItem =
  | { kind: "link"; label: string; href: string; icon?: ReactNode }
  | { kind: "button"; label: string; onClick: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean };

/** Не открывать меню, если нажали на что-то своё внутри строки — чекбокс,
 * кнопку-иконку, ссылку — или в ячейку, помеченную data-row-menu-ignore
 * (ячейка чекбокса, ячейка с иконками): промах мимо маленькой цели не должен
 * вдруг открывать меню. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, label, select, textarea, [data-row-menu-ignore]"))
  );
}

/**
 * Меню действий строки таблицы, открытое по клику на строку — рядом с
 * курсором (или под строкой, если открыли с клавиатуры).
 *
 * Закрывается кликом мимо, Escape, прокруткой и выбором пункта. Не выходит за
 * край окна: у правого края открывается влево, у нижнего — вверх.
 */
export default function RowMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: RowMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const margin = 8;
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: y + height + margin > window.innerHeight ? Math.max(margin, y - height) : y,
    });
  }, [x, y]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("a, button:not(:disabled)")?.focus();
    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: position.left, top: position.top }}
      className="fixed z-50 flex min-w-48 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((item) =>
        item.kind === "link" ? (
          <Link
            key={item.label}
            href={item.href}
            role="menuitem"
            onClick={onClose}
            className={`${itemClass} text-zinc-700 hover:bg-zinc-100 hover:text-orange-600 focus:bg-zinc-100 focus:text-orange-600 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800`}
          >
            <span className="shrink-0 opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onClick();
            }}
            className={`${itemClass} ${
              item.danger
                ? "text-red-600 hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-950/40 dark:focus:bg-red-950/40"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-orange-600 focus:bg-zinc-100 focus:text-orange-600 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
            }`}
          >
            <span className="shrink-0 opacity-70">{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </div>,
    document.body
  );
}

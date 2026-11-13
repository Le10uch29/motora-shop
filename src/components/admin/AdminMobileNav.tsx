"use client";

import { useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEscapeKey } from "@/hooks/useEscapeKey";

/**
 * Боковое меню админки на телефоне: кнопка-бургер в шапке и панель, которая
 * выезжает слева поверх страницы.
 *
 * На широком экране меню — обычная колонка слева (её рисует layout), а эта
 * кнопка и панель скрыты (md:hidden). Содержимое панели — те же ссылки, что и
 * в колонке: layout передаёт их сюда готовыми (children).
 *
 * Закрывается тапом по затемнению, крестиком, Escape и переходом по ссылке.
 * Закрытая панель не просто уезжает за край: она inert — с клавиатуры в неё
 * не попасть, и экранный диктор её не читает.
 */
export default function AdminMobileNav({
  openLabel,
  closeLabel,
  children,
}: {
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEscapeKey(() => setOpen(false), open);
  // document есть только в браузере: на сервере портала нет, панель
  // появляется после загрузки страницы (закрытой её всё равно не видно).
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // Перешли на другую страницу — меню закрывается.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Тап по ссылке той же страницы адрес не меняет — закрываем и тогда.
  function handlePanelClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        aria-label={openLabel}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-200"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Панель уходит порталом в body. Внутри шапки ей нельзя: у шапки
          анимирован filter (flame-pulse), а элемент с filter становится
          рамкой для потомков с position: fixed — панель растягивалась на
          шапку, а не на экран, и оказывалась под содержимым страницы. */}
      {mounted && createPortal(
      <div className={`fixed inset-0 z-[60] md:hidden ${open ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <aside
          id="admin-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label={openLabel}
          inert={!open}
          onClick={handlePanelClick}
          className={`flame-sidebar absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-zinc-200 px-4 py-4 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none dark:border-zinc-800 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {children}
        </aside>
      </div>,
      document.body
      )}
    </div>
  );
}

const subscribeNothing = () => () => {};

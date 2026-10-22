/**
 * Что посетитель выбрал сам — язык и тему — запоминается в браузере.
 *
 * Хранится в двух местах сразу: в localStorage (как и раньше) и в cookie.
 * Cookie нужна серверу: по ней proxy открывает сайт на выбранном языке, а
 * корневой layout сразу отдаёт <html class="dark">. Без этого тёмная тема
 * пропадала при смене языка: layout с <html> рисуется заново под новый язык,
 * а скрипт, ставивший класс из localStorage, при переходе внутри сайта уже
 * не запускается.
 *
 * Модуль без серверных импортов — его используют и клиентские компоненты.
 */

export const THEME_KEY = "araz-motors-theme";
export const LOCALE_KEY = "araz-motors-locale";

export type Theme = "light" | "dark";

/** Год — выбор не должен «забываться» через неделю. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function savePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Приватный режим / хранилище отключено — останется только cookie.
  }
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

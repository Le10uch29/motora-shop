"use client";

import { useEffect } from "react";

function isNumberInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === "number";
}

/**
 * Числа в полях (цена, количество, остаток, годы) только вводятся — без
 * изменения на единицу. Стрелки у полей скрыты в globals.css, а здесь
 * гасятся оставшиеся два способа: колёсико мыши над полем в фокусе и клавиши
 * ↑/↓. Иначе прокрутка страницы с курсором на поле цены незаметно меняла бы
 * цену.
 *
 * Один обработчик на весь документ — работает для всех числовых полей сразу,
 * в том числе в модальных окнах. Ничего не рисует.
 */
export default function NumberInputGuard() {
  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      if (isNumberInput(event.target) && event.target === document.activeElement) {
        event.preventDefault();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && isNumberInput(event.target)) {
        event.preventDefault();
      }
    }
    // passive: false — иначе браузер не даст отменить прокрутку колёсиком.
    document.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
